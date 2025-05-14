import { join, format } from 'node:path';

import { PartitionFrame } from '@_all_docs/frame';

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
async function createRevIndex({ source, format }) {
  // Remark (0): should this be a static method on PartitionFrame? Probably.

  // TODO (0): display progress as it is being created
  const index = PartitionFrame.fromCache(source)
    .reduce((acc, partition, i) => {
      const { rows } = partition;

      const addToIndex = format === 'append-only'
        ? rows.map(entryToTuple)
        : rows;

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

  const index = await createRevIndex({ source, format });
  const fullpath = join(source, filename);

  process.stdout.write(index);

  // TODO (0): better handle final output step
  // return {
  //   action: 'write',
  //   fullpath,
  //   utf8: index
  // };
}
