import { join, resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
import process from 'node:process';
import { Cache, createStorageDriver } from '@_all_docs/cache';
import { Packument } from '@_all_docs/packument';

export const command = async cli => {
  // Create environment for storage driver
  const env = {
    RUNTIME: 'node',
    CACHE_DIR: cli.dir('packuments')
  };

  // Create storage driver
  const driver = await createStorageDriver(env);
  
  const cache = new Cache({ path: cli.dir('packuments'), driver });

  const [namesPath, outPath] = cli._;
  if (!namesPath) {
    console.error('No file with packument names provided');
    return;
  }

  if (!outPath) {
    console.error('No output directory provided');
    return;
  }

  const namesFile = resolve(process.cwd(), namesPath);
  const outDir = resolve(process.cwd(), outPath);

  const { default: names } = await import(namesFile, { with: { type: 'json' } });
  if (!Array.isArray(names)) {
    console.error('File with packument names must be an array');
    return;
  }

  for (const name of names) {
    const key = Packument.cacheKey(name, cli.values.registry);
    const val = await cache.fetch(key);
    if (!val) {
      console.error(`Packument ${name} not found in cache`);
      continue;
    }

    const pku = Packument.fromCacheEntry([key, val]);
    const filename = `${encodeURIComponent(pku.name)}.json`;
    const fullpath = join(outDir, filename);
    writeFileSync(fullpath, JSON.stringify(pku.contents, null, 2));
    console.log(`Wrote ${filename} to ${outDir}`);
  }
};

