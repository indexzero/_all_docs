import { Cache } from '@_all_docs/cache';
import { Partition, PartitionClient } from '@_all_docs/partition';

export const command = async cli => {
  const client = new PartitionClient({
    origin: cli.values.origin
  });

  const res = await client.request({
    startKey: cli.values.start,
    endKey: cli.values.end
  }, {
    cache: cli.values.cache,
    refresh: cli.values.refresh
  });

  console.log(res);
}
