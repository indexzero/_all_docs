import { rm, readdir } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { Cache, decodeCacheKey, createStorageDriver, createPackumentKey } from '@_all_docs/cache';

export const usage = `Usage: _all_docs cache clear [options]

Clear cache entries.

Options:
  --packuments       Clear packument cache only
  --partitions       Clear partition cache only
  --checkpoints      Clear checkpoint files only
  --registry <url>   Clear entries for specific registry origin
  --match-origin <key>  Clear entries matching origin key (e.g., paces.exale.com~javpt)
  --package <name>   Clear cache for specific package
  --older-than <dur> Clear entries older than duration (e.g., 7d, 24h, 30m)
  --dry-run          Show what would be cleared without deleting
  --interactive      Prompt for confirmation before clearing

Examples:
  _all_docs cache clear                           # Clear everything
  _all_docs cache clear --packuments              # Clear only packuments
  _all_docs cache clear --partitions              # Clear only partitions
  _all_docs cache clear --checkpoints             # Clear only checkpoints
  _all_docs cache clear --registry https://registry.npmjs.com
  _all_docs cache clear --match-origin paces.exale.com~javpt
  _all_docs cache clear --dry-run                 # Preview what would be cleared
  _all_docs cache clear --interactive             # Confirm before clearing
  _all_docs cache clear --packuments --older-than 7d
  _all_docs cache clear --package lodash
`;

/**
 * Parse duration string to milliseconds
 * @param {string} duration - Duration string (e.g., "7d", "24h", "30m")
 * @returns {number} Duration in milliseconds
 */
function parseDuration(duration) {
  const match = duration.match(/^(\d+)(d|h|m|s)$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}. Use format like 7d, 24h, 30m, or 60s`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };

  return value * multipliers[unit];
}

/**
 * Prompt user for confirmation
 * @param {string} message - Confirmation message
 * @returns {Promise<boolean>} User's response
 */
async function confirm(message) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(`${message} [y/N] `, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Clear entries from a cache directory
 * @param {Object} options - Clear options
 * @returns {Promise<{cleared: number, skipped: number}>}
 */
async function clearCache({ cachePath, registry, origin, packageName, olderThan, dryRun, entityType }) {
  const env = { CACHE_DIR: cachePath };
  const driver = await createStorageDriver(env);
  const cache = new Cache({ path: cachePath, driver });

  let cleared = 0;
  let skipped = 0;
  const now = Date.now();

  // Fast path: clear everything if no filters
  if (!registry && !origin && !packageName && !olderThan) {
    // Count entries first
    for await (const key of cache.keys('')) {
      try {
        const decoded = decodeCacheKey(key);
        if (!entityType || decoded.type === entityType) {
          const displayName = decoded.type === 'packument'
            ? decoded.packageName
            : `partition:${decoded.startKey || ''}..${decoded.endKey || ''}`;

          if (dryRun) {
            console.log(`  [dry-run] Would delete: ${displayName}`);
          }
          cleared++;
        }
      } catch {
        cleared++;
      }
    }

    if (!dryRun && cleared > 0) {
      await driver.clear();
      console.log(`  Cleared ${cleared} entries`);
    }

    return { cleared, skipped };
  }

  // If clearing specific package, construct the key directly
  if (packageName) {
    const registryUrl = registry || 'https://registry.npmjs.com';
    const key = createPackumentKey(packageName, registryUrl);

    try {
      const exists = await cache.has(key);
      if (exists) {
        if (dryRun) {
          console.log(`  [dry-run] Would delete: ${packageName} (${registryUrl})`);
        } else {
          await driver.delete(key);
          console.log(`  Deleted: ${packageName}`);
        }
        cleared++;
      } else {
        console.log(`  Not found: ${packageName}`);
        skipped++;
      }
    } catch (error) {
      console.error(`  Error clearing ${packageName}: ${error.message}`);
      skipped++;
    }

    return { cleared, skipped };
  }

  // Iterate all entries with filters
  for await (const key of cache.keys('')) {
    try {
      const decoded = decodeCacheKey(key);

      // Filter by entity type
      if (entityType && decoded.type !== entityType) {
        continue;
      }

      // Filter by registry URL
      if (registry) {
        const keyForRegistry = createPackumentKey('test', registry);
        const decodedRegistry = decodeCacheKey(keyForRegistry);
        if (decoded.origin !== decodedRegistry.origin) {
          skipped++;
          continue;
        }
      }

      // Filter by origin key directly
      if (origin && !key.includes(`:${origin}:`)) {
        skipped++;
        continue;
      }

      // Filter by age
      if (olderThan) {
        try {
          const info = await driver.info(key);
          if (info && info.time) {
            const age = now - info.time;
            if (age < olderThan) {
              skipped++;
              continue;
            }
          }
        } catch {
          // If we can't get info, skip the age check
        }
      }

      // Clear the entry
      const displayName = decoded.type === 'packument'
        ? decoded.packageName
        : `partition:${decoded.startKey || ''}..${decoded.endKey || ''}`;

      if (dryRun) {
        console.log(`  [dry-run] Would delete: ${displayName} (${decoded.origin})`);
      } else {
        await driver.delete(key);
        console.log(`  Deleted: ${displayName}`);
      }
      cleared++;
    } catch (error) {
      // Skip entries that can't be decoded or deleted
      skipped++;
    }
  }

  return { cleared, skipped };
}

/**
 * Clear checkpoint files
 * @param {string} checkpointDir - Checkpoint directory path
 * @param {boolean} dryRun - Whether to do a dry run
 * @returns {Promise<{cleared: number}>}
 */
async function clearCheckpoints(checkpointDir, dryRun) {
  let cleared = 0;

  try {
    const files = await readdir(checkpointDir);

    for (const file of files) {
      if (file.endsWith('.checkpoint.json')) {
        const filePath = `${checkpointDir}/${file}`;
        if (dryRun) {
          console.log(`  [dry-run] Would delete: ${file}`);
        } else {
          await rm(filePath);
          console.log(`  Deleted: ${file}`);
        }
        cleared++;
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(`  Error clearing checkpoints: ${error.message}`);
    }
  }

  return { cleared };
}

export const command = async cli => {
  if (cli.values.help) {
    console.log(usage);
    return;
  }

  const clearPackuments = cli.values.packuments;
  const clearPartitions = cli.values.partitions;
  const clearCheckpointsFlag = cli.values.checkpoints;
  const registry = cli.values.registry;
  const origin = cli.values['match-origin'];
  const packageName = cli.values.package;
  const olderThanStr = cli.values['older-than'];
  const dryRun = cli.values['dry-run'];
  const interactive = cli.values.interactive;

  // Parse duration if provided
  let olderThan = null;
  if (olderThanStr) {
    try {
      olderThan = parseDuration(olderThanStr);
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  }

  // If no specific type selected, clear all
  const clearAll = !clearPackuments && !clearPartitions && !clearCheckpointsFlag;

  // Build summary of what will be cleared
  const targets = [];
  if (clearAll || clearPackuments) targets.push('packuments');
  if (clearAll || clearPartitions) targets.push('partitions');
  if (clearAll || clearCheckpointsFlag) targets.push('checkpoints');

  let description = `Clear ${targets.join(', ')}`;
  if (registry) description += ` for registry ${registry}`;
  if (origin) description += ` matching origin ${origin}`;
  if (packageName) description += ` for package ${packageName}`;
  if (olderThan) description += ` older than ${olderThanStr}`;

  console.log(description);
  console.log();

  // Interactive confirmation
  if (interactive && !dryRun) {
    const confirmed = await confirm('Are you sure you want to proceed?');
    if (!confirmed) {
      console.log('Aborted.');
      process.exit(0);
    }
    console.log();
  }

  let totalCleared = 0;
  let totalSkipped = 0;

  // Clear packuments
  if (clearAll || clearPackuments) {
    const packumentsDir = cli.dir('packuments');
    console.log(`Packuments (${packumentsDir}):`);

    const result = await clearCache({
      cachePath: packumentsDir,
      registry,
      origin,
      packageName,
      olderThan,
      dryRun,
      entityType: 'packument'
    });

    totalCleared += result.cleared;
    totalSkipped += result.skipped;

    if (result.cleared === 0 && result.skipped === 0) {
      console.log('  (empty)');
    }
    console.log();
  }

  // Clear partitions
  if ((clearAll || clearPartitions) && !packageName) {
    const partitionsDir = cli.dir('partitions');
    console.log(`Partitions (${partitionsDir}):`);

    const result = await clearCache({
      cachePath: partitionsDir,
      registry,
      origin,
      olderThan,
      dryRun,
      entityType: 'partition'
    });

    totalCleared += result.cleared;
    totalSkipped += result.skipped;

    if (result.cleared === 0 && result.skipped === 0) {
      console.log('  (empty)');
    }
    console.log();
  }

  // Clear checkpoints
  if ((clearAll || clearCheckpointsFlag) && !packageName && !registry && !origin) {
    const checkpointsDir = `${cli.dir('packuments')}/../checkpoints`;
    console.log(`Checkpoints (${checkpointsDir}):`);

    const result = await clearCheckpoints(checkpointsDir, dryRun);
    totalCleared += result.cleared;

    if (result.cleared === 0) {
      console.log('  (empty)');
    }
    console.log();
  }

  // Summary
  const action = dryRun ? 'Would clear' : 'Cleared';
  console.log(`${action} ${totalCleared} entries${totalSkipped > 0 ? `, skipped ${totalSkipped}` : ''}`);
};
