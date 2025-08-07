import { PackumentClient } from '@_all_docs/packument';

export const command = async cli => {
  // Create environment for storage driver
  const env = {
    RUNTIME: 'node',
    CACHE_DIR: cli.dir('packuments'),
    NPM_REGISTRY: cli.values.registry
  };

  const client = new PackumentClient({ env });

  if (!cli._[0]) {
    console.error('No packument name provided');
    return;
  }

  const packageName = cli._[0];

  console.log(`Fetching ${packageName} from ${cli.values.registry}`, {
    cache: cli.values.cache,
    refresh: cli.values.refresh
  });

  const res = await client.request(packageName, {
    cache: cli.values.cache,
    refresh: cli.values.refresh
  });

  console.log(res);
};
