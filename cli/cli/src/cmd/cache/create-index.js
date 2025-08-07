import { join } from 'node:path';
import process from 'node:process';
import { PartitionFrame } from '@_all_docs/frame';
import { createStorageDriver } from '@_all_docs/worker';

/**
 * Converts an entry object to a tuple.
 * @param {Entry} entry
 * @returns {[string, string]}
 */
function entryToTuple({ id, key, value }) {
  return [id || key, value.rev];
}

/**
 * Writes the all docs index.
 * @param {{ partitions: Partition[], cacheDir: string, format?: string }} params
 * @returns {Promise<void>}
 */
async function createRevIndex({ source, format, env }) {
  // Remark (0): should this be a static method on PartitionFrame? Probably.

  // Create storage driver for the cache
  const driver = await createStorageDriver(env);

  // TODO (0): display progress as it is being created
  const frame = PartitionFrame.fromCache(source, driver);
  const index = await frame.reduceAsync((acc, partition) => {
    const { rows } = partition;

    const addToIndex = format === 'append-only'
      ? rows.map(entryToTuple)
      : rows;

    // eslint-disable-next-line prefer-spread
    acc.push.apply(acc, addToIndex);
    return acc;
  }, []);

  return format === 'append-only'
    ? index.map(([_id, _rev]) => `${_id},${_rev}`).join('\n')
    : JSON.stringify(index, null, 2);
}

export const command = async cli => {
  const source = cli.dir('partitions');
  const format = cli.get('format') || 'append-only';

  const filename = format === 'json'
    ? '.rev.index.json'
    : '.rev.index';

  // Create environment for storage driver
  const env = {
    RUNTIME: 'node',
    CACHE_DIR: source
  };

  const index = await createRevIndex({ source, format, env });
  const _fullpath = join(source, filename);

  process.stdout.write(index);

  // TODO (0): better handle final output step
  // return {
  //   action: 'write',
  //   fullpath,
  //   utf8: index
  // };
};
