import { basename, resolve, extname } from 'node:path';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import pMap from 'p-map';
import npa from 'npm-package-arg';
import { PackumentClient } from '@_all_docs/packument';
import { PackumentListCheckpoint } from '../../checkpoint.js';

/**
 * Parse a text file containing package names
 * @param {string} filepath - Path to the text file
 * @returns {string[]} Array of package names
 */
function parseTextFile(filepath) {
  const content = readFileSync(filepath, 'utf8');
  const lines = content.split('\n');
  const packages = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    try {
      // Use npm-package-arg to properly parse package specs
      // This handles scoped packages, versions, tags, etc.
      const parsed = npa(trimmed);

      // Get the package name (works for both regular and scoped packages)
      if (parsed.name) {
        packages.push(parsed.name);
      }
    } catch (err) {
      // Log warning but continue processing other packages
      console.warn(`Warning: Invalid package spec "${trimmed}": ${err.message}`);
    }
  }

  return packages;
}

/**
 * Load package names from input file
 * @param {string} fullpath - Absolute path to input file
 * @returns {Promise<string[]>} Array of package names
 */
async function loadPackageNames(fullpath) {
  const ext = extname(fullpath).toLowerCase();

  if (ext === '.json') {
    const { default: jsonData } = await import(fullpath, { with: { type: 'json' } });
    return Array.isArray(jsonData) ? jsonData : [jsonData];
  } else if (ext === '.txt' || ext === '.text' || ext === '') {
    return parseTextFile(fullpath);
  } else {
    throw new Error(`Unsupported file type: ${ext}. Use .json or .txt files.`);
  }
}

/**
 * Display checkpoint status and exit
 * @param {PackumentListCheckpoint} checkpoint
 */
function showStatus(checkpoint) {
  const status = checkpoint.getStatus();

  if (!status) {
    console.log('No checkpoint found for this input file.');
    console.log(`Expected: ${checkpoint.checkpointPath}`);
    process.exit(1);
  }

  console.log(`Checkpoint: ${status.checkpointPath}`);
  console.log(`Input: ${status.inputFile} (${status.inputHashMatch ? 'unchanged' : 'CHANGED'})`);
  console.log('');
  console.log(`Total:     ${status.stats.total}`);
  console.log(`Completed: ${status.stats.completed} (${status.percentComplete}%)`);
  console.log(`  Cached:  ${status.stats.cached}`);
  console.log(`  Fetched: ${status.stats.fetched}`);
  console.log(`Pending:   ${status.stats.pending}`);
  console.log(`Failed:    ${status.stats.failed}`);
  console.log('');
  console.log(`Last updated: ${status.updatedAt}`);
}

/**
 * Display failed packages and exit
 * @param {PackumentListCheckpoint} checkpoint
 */
function showFailed(checkpoint) {
  if (!checkpoint.load()) {
    console.log('No checkpoint found for this input file.');
    process.exit(1);
  }

  const failed = checkpoint.getFailed();

  if (failed.length === 0) {
    console.log('No failed packages.');
    return;
  }

  console.log(`Failed packages (${failed.length}):\n`);
  for (const { name, error, attempts } of failed) {
    console.log(`  ${name}`);
    console.log(`    Error: ${error}`);
    console.log(`    Attempts: ${attempts}`);
  }
}

export const command = async cli => {
  const fullpath = resolve(process.cwd(), cli._[0] ?? 'npm-high-impact.json');
  const filename = basename(fullpath);

  // Initialize checkpoint
  const checkpoint = new PackumentListCheckpoint(fullpath);
  const useCheckpoint = cli.values.checkpoint || cli.values.resume || cli.values.status || cli.values['list-failed'];

  // Handle --status: show status and exit
  if (cli.values.status) {
    checkpoint.load();
    showStatus(checkpoint);
    return;
  }

  // Handle --list-failed: show failed packages and exit
  if (cli.values['list-failed']) {
    showFailed(checkpoint);
    return;
  }

  // Load package names from input file
  const allPackageNames = await loadPackageNames(fullpath);
  const total = allPackageNames.length;

  // Determine which packages to fetch
  let packageNames;

  if (cli.values.fresh) {
    // --fresh: delete existing checkpoint and start over
    checkpoint.delete();
    checkpoint.initialize(allPackageNames);
    packageNames = allPackageNames;
    console.log(`Starting fresh: ${total} packuments from ${filename}`);
  } else if (cli.values.resume) {
    // --resume: load checkpoint and continue
    if (!checkpoint.load()) {
      console.error('No checkpoint found to resume. Use --checkpoint to start a new run.');
      process.exit(1);
    }

    if (!checkpoint.verifyInputHash()) {
      console.error('Input file has changed since checkpoint was created.');
      console.error('Use --fresh to start over, or restore the original input file.');
      process.exit(1);
    }

    packageNames = checkpoint.getPending();
    const completed = total - packageNames.length;
    console.log(`Resuming from checkpoint: ${completed}/${total} completed`);
    console.log(`Fetching remaining ${packageNames.length} packuments from ${filename}`);
  } else if (cli.values.checkpoint) {
    // --checkpoint: create new checkpoint or resume if exists
    if (checkpoint.exists()) {
      checkpoint.load();
      if (!checkpoint.verifyInputHash()) {
        console.error('Input file has changed since checkpoint was created.');
        console.error('Use --fresh to start over, or restore the original input file.');
        process.exit(1);
      }
      packageNames = checkpoint.getPending();
      const completed = total - packageNames.length;
      console.log(`Found existing checkpoint: ${completed}/${total} completed`);
      console.log(`Fetching remaining ${packageNames.length} packuments`);
    } else {
      checkpoint.initialize(allPackageNames);
      packageNames = allPackageNames;
      console.log(`Checkpoint enabled: ${total} packuments from ${filename}`);
    }
  } else {
    // No checkpoint flags: run without checkpoint
    packageNames = allPackageNames;
    console.log(`Fetching ${total} packuments from ${filename}`);
  }

  if (packageNames.length === 0) {
    console.log('All packages already completed!');
    if (useCheckpoint) {
      showStatus(checkpoint);
    }
    return;
  }

  // Get the registry URL from config
  const registryUrl = cli.getRegistry();

  // Create environment for storage driver
  const env = {
    RUNTIME: 'node',
    CACHE_DIR: cli.dir('packuments'),
    NPM_REGISTRY: registryUrl
  };

  const client = new PackumentClient({
    origin: registryUrl,
    authToken: cli.authToken,
    auth: cli.auth,
    limit: cli.values.limit,
    dryRun: cli.values.dryRun,
    env
  });

  // Track progress with atomic counter for concurrent access
  let processedCount = 0;
  let interrupted = false;
  const startOffset = useCheckpoint ? (total - packageNames.length) : 0;

  // Atomic increment for progress tracking
  const getNextIndex = () => {
    const current = startOffset + processedCount + 1;
    processedCount++;
    return current;
  };

  // Set up SIGINT handler for graceful shutdown
  const sigintHandler = () => {
    interrupted = true;
    console.log('\nInterrupted! Saving checkpoint...');
  };

  if (useCheckpoint) {
    process.on('SIGINT', sigintHandler);
  }

  try {
    await pMap(packageNames, async name => {
      if (interrupted) {
        throw new Error('Interrupted');
      }

      const current = getNextIndex();
      const prefix = `[${current}/${total}] ${name}`;

      if (useCheckpoint) {
        checkpoint.markInProgress(name);
      }

      try {
        const entry = await client.request(name);
        const cached = entry?.hit ?? false;

        if (useCheckpoint) {
          checkpoint.markCompleted(name, cached);
        }

        const percent = ((current / total) * 100).toFixed(1);
        console.log(`${prefix} - ${cached ? 'cached' : 'fetched'} (${percent}%)`);

        // Periodic checkpoint save every 100 packages
        if (useCheckpoint && current % 100 === 0) {
          checkpoint.saveIfDirty();
        }
      } catch (err) {
        if (useCheckpoint) {
          checkpoint.markFailed(name, err.message);
        }
        console.error(`${prefix} - failed: ${err.message}`);
      }
    }, { concurrency: 10, stopOnError: false });
  } catch (err) {
    if (err.message !== 'Interrupted') {
      throw err;
    }
  } finally {
    // Clean up SIGINT handler
    if (useCheckpoint) {
      process.off('SIGINT', sigintHandler);
      checkpoint.save();
    }
  }

  // Final summary
  if (useCheckpoint) {
    console.log('');
    if (interrupted) {
      const status = checkpoint.getStatus();
      console.log(`Checkpoint saved: ${status.stats.completed}/${total} (${status.percentComplete}%)`);
      console.log(`Resume with: npx _all_docs packument fetch-list ${cli._[0]} --resume`);
    } else {
      showStatus(checkpoint);
    }
  }
};
