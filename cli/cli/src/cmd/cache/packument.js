import { Cache } from '@_all_docs/cache';
import { Packument } from '@_all_docs/packument';

export const command = async cli => {
  if (!cli._[0]) {
    console.error('No packument name provided');
    return;
  }

  const name = cli._[0];
  const key = Packument.cacheKey(
    name,
    cli.values.registry
  );

  const cache = new Cache({ path: cli.dir('packuments') });
  const val = await cache.fetch(key);
  if (!val) {
    console.error('Packument not found in cache');
    return;
  }

  const pku = Packument.fromCacheEntry([key, val]);

  console.dir(pku.contents);
}
