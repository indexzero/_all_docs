/**
 *
 * @attribution portions of this file are derived from vltpkg released
 * by `vlt technology, Inc.`. They are cited with @url below and reused
 * in accordance with the BSD-2-Clause-Patent license that project is
 * licensed under.
 *
 * @url https://github.com/vltpkg/vltpkg/blob/63f8a60/LICENSE
 * @url https://github.com/vltpkg/vltpkg/blob/63f8a60/src/registry-client/src/index.ts#L395-L548
 */

import { resolve } from 'node:path';

import pMap from 'p-map';
import { RegistryClient, CacheEntry } from '@vltpkg/registry-client';
import { XDG } from '@vltpkg/xdg';
import { Cache } from '@vltpkg/cache'


const xdg = new XDG('_all_docs');

export class PackumentClient extends RegistryClient {
  constructor(options = {}) {
    // Override the cache to be a location that we wish it to be
    const cache = options.cache = options.cache || xdg.cache();
    super(options);
    const path = resolve(cache, 'packuments');
    this.cache = new Cache({
      path,
      onDiskWrite(_path, key, data) {
        if (CacheEntry.isGzipEntry(data)) {
          cacheUnzipRegister(path, key)
        }
      },
    });

    // Grab our own options out of it
    this.origin = options.origin;
    this.dryRun = options.dryRun;
    this.limit = options.limit || 10;

    // Strip methods that we don't need
    delete this.scroll;
    delete this.seek;
    delete this.logout;
    delete this.login;
    delete this.webAuthOpener;
  }

  async requestAll(packages, options = {}) {
    const {
      limit = this.limit,
      dryRun = this.dryRun
    } = options;

    let misses = 0;
    const entries = await pMap(packages, async (name) => {
      const url = this.#url(name);
      const entry = await this.request(url, options);
      if (!entry.hit && !dryRun) {
        misses = misses + 1;
      }

      return entry;
    }, { concurrency: limit });

    return entries;
  }

  #url(name) {
    return new URL(`/${name}`, this.origin);
  }
}
