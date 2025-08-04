import { basename, resolve } from 'node:path';
import pMap from 'p-map';
import { PackumentClient } from '@_all_docs/packument';

export const command = async cli => {
  const fullpath = resolve(process.cwd(), cli._[0] ?? 'npm-high-impact.json');
  const filename = basename(fullpath);

  const { default: packageNames } = await import(fullpath, { with: { type: 'json' } });
  const { length } = packageNames;

  console.log(`Fetching ${length} packuments from ${filename}`);

  const client = new PackumentClient({
    origin: cli.values.registry,
    limit: cli.values.limit,
    dryRun: cli.values.dryRun
  });

  let fetched = 0;
  await pMap(packageNames, async name => {
    const prefix = `Fetch packument | ${name}`;

    console.log(prefix);
    await client.request(new URL(name, cli.values.registry));
    fetched += 1;
    console.log(`${prefix} | ok | ${((fetched / length) * 100).toFixed(2)}%`);
  }, { concurrency: 10 });
};
