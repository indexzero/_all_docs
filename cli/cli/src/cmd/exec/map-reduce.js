import { resolve } from 'node:path';
import { execId } from '@_all_docs/exec';
import { PackumentFrame } from '@_all_docs/frame';

export const command = async cli => {
  const { design, exec } = cli.values;

  if (!design || !exec) {
    console.error('No design document or view name provided');
    return;
  }

  const fullpath = resolve(process.cwd(), design);
  const designDoc = await import(fullpath);
  const view = designDoc.default.views[exec];

  if (!view) {
    console.error(`View ${exec} not found in design document`);
    return;
  }

  const { map, reduce, group } = view;
  const eid = execId(4);

  const frame = PackumentFrame.fromCache(cli.dir('packuments'))
    .map(map, { concurrency: 100 });

  const results = await Array.fromAsync(frame);

  debug('write map output |', eid, results.length);
  await writeFile(`map-${eid}.json`, JSON.stringify(results, null, 2), 'utf8');

  if (reduce) {
    const reduced = reduce(results);
    debug('write reduce output |', eid);
    await writeFile(`reduce-${eid}.json`, JSON.stringify(reduced, null, 2), 'utf8');
  }

  if (group) {
    const groups = group(results);
    debug('write group output |', eid);
    await writeFile(`groups-${eid}.json`, JSON.stringify(groups, null, 2), 'utf8');
  }
};
