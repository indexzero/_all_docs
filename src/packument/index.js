import { CacheEntry } from '@vltpkg/registry-client';

import { PackumentClient } from "./client.js";

class Packument {
  constructor({ name, contents, origin }) {
    this.name = name;
    this.contents = contents;
  }

  static cacheKey(name, origin = 'https://registry.npmjs.com') {
    return `${new URL(name, origin)}`;
  }

  static fromCacheEntry([key, val]) {
    const where = new URL(key);
    const name = where.pathname.slice(1);
    const entry = CacheEntry.decode(val);
    const body = entry.json();

    // TODO (0): include all CacheEntry metadata (e.g. headers, etc)
    return new Packument({
      name,
      contents: body,
      origin: where.origin
    });
  }

}

export {
  Packument,
  PackumentClient
}
