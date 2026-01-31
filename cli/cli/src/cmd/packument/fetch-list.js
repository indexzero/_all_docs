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
 * Display checkpoint status
 * @param {PackumentListCheckpoint} checkpoint
 * @param {number} total - Total packages from input file
 */
function showStatus(checkpoint, total) {
  const status = checkpoint.getStatus();

  if (!status) {
    // No checkpoint yet - show "not started" status
    console.log(`Checkpoint: ${checkpoint.checkpointPath}`);
    console.log(`Status: Not started`);
    console.log('');
    console.log(`Total:     ${total}`);
    console.log(`Completed: 0 (0.0%)`);
    console.log(`Pending:   ${total}`);
    return;
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
 * Display failed packages
 * @param {PackumentListCheckpoint} checkpoint
 */
function showFailed(checkpoint) {
  if (!checkpoint.load()) {
    console.log('No checkpoint found. Run a fetch first.');
    return;
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

  // Checkpoint is enabled by default, disabled with --no-checkpoint
  const useCheckpoint = cli.values.checkpoint && !cli.values['no-checkpoint'];

  // Initialize checkpoint
  const checkpoint = new PackumentListCheckpoint(fullpath);

  // Load package names from input file
  const allPackageNames = await loadPackageNames(fullpath);
  const total = allPackageNames.length;

  // Handle --status: show status and exit
  if (cli.values.status) {
    checkpoint.load();
    showStatus(checkpoint, total);
    return;
  }

  // Handle --list-failed: show failed packages and exit
  if (cli.values['list-failed']) {
    showFailed(checkpoint);
    return;
  }

  // Determine which packages to fetch
  let packageNames;

  if (cli.values.fresh) {
    // --fresh: delete existing checkpoint and start over
    checkpoint.delete();
    if (useCheckpoint) {
      checkpoint.initialize(allPackageNames);
    }
    packageNames = allPackageNames;
    console.log(`Starting fresh: ${total} packuments from ${filename}`);
  } else if (useCheckpoint) {
    // Checkpoint mode (default): create or resume
    if (checkpoint.exists()) {
      checkpoint.load();
      if (!checkpoint.verifyInputHash()) {
        console.error('Input file has changed since checkpoint was created.');
        console.error('Use --fresh to start over, or restore the original input file.');
        process.exit(1);
      }
      packageNames = checkpoint.getPending();
      const completed = total - packageNames.length;
      if (completed > 0) {
        console.log(`Resuming: ${completed}/${total} completed`);
        console.log(`Fetching remaining ${packageNames.length} packuments from ${filename}`);
      } else {
        console.log(`Fetching ${total} packuments from ${filename}`);
      }
    } else {
      checkpoint.initialize(allPackageNames);
      packageNames = allPackageNames;
      console.log(`Fetching ${total} packuments from ${filename}`);
    }
  } else {
    // --no-checkpoint: run without checkpoint
    packageNames = allPackageNames;
    console.log(`Fetching ${total} packuments from ${filename} (no checkpoint)`);
  }

  if (packageNames.length === 0) {
    console.log('All packages already completed!');
    if (useCheckpoint) {
      console.log('');
      showStatus(checkpoint, total);
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
      console.log(`Resume with: _all_docs packument fetch-list ${cli._[0]}`);
    } else {
      showStatus(checkpoint, total);
    }
  }
};
