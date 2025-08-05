import { PackumentClient } from '@_all_docs/packument';

export const command = async cli => {
  const client = new PackumentClient();

  if (!cli._[0]) {
    console.error('No packument name provided');
    return;
  }

  const where = new URL(cli._[0], cli.values.registry);

  console.log(`${where}`, {
    cache: cli.values.cache,
    refresh: cli.values.refresh
  });

  const res = await client.request(where, {
    cache: cli.values.cache,
    refresh: cli.values.refresh
  });

  console.log(res);
};
