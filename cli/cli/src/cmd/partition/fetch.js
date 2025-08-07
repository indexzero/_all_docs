import { PartitionClient } from '@_all_docs/partition';

export const command = async cli => {
  // Create environment for storage driver
  const env = {
    RUNTIME: 'node',
    CACHE_DIR: cli.dir('partitions'),
    NPM_ORIGIN: cli.values.origin
  };

  const client = new PartitionClient({
    origin: cli.values.origin,
    env
  });

  // Initialize the client to ensure storage driver is ready
  await client.initializeAsync(env);

  const res = await client.request({
    startKey: cli.values.start,
    endKey: cli.values.end
  }, {
    cache: cli.values.cache,
    refresh: cli.values.refresh
  });

  console.log(res);
};
