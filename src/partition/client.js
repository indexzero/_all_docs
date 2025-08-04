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
import { Cache } from '@vltpkg/cache';
import { register as cacheUnzipRegister } from '@vltpkg/cache-unzip';

// Here. Be. Dragons. 🐲
import unstable from './unstable.js';
import { Partition } from './index.js';

const { setCacheHeaders } = await unstable('set-cache-headers.js');
const { addHeader } = await unstable('add-header.js');
const { register } = await unstable('cache-revalidate.js');

// Remark (0): these probably don't belong here, but < 1.0.0 so <shrug>
const userAgent = '_all_docs/0.1.0';
const agentOptions = {
  bodyTimeout: 600_000,
  headersTimeout: 600_000,
  keepAliveMaxTimeout: 1_200_000,
  keepAliveTimeout: 600_000,
  keepAliveTimeoutThreshold: 30_000,
  connect: {
    timeout: 600_000,
    keepAlive: true,
    keepAliveInitialDelay: 30_000,
    sessionTimeout: 600
  },
  connections: 256,
  pipelining: 10
};

const xdg = new XDG('_all_docs');

export class PartitionClient extends RegistryClient {
  constructor(options = {}) {
    // Override the cache to be a location that we wish it to be
    const cache = options.cache = options.cache || xdg.cache();
    super(options);
    const path = resolve(cache, 'partitions');
    this.cache = new Cache({
      path,
      onDiskWrite(_path, key, data) {
        if (CacheEntry.isGzipEntry(data)) {
          cacheUnzipRegister(path, key);
        }
      }
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

  async requestAll(partitions, options = {}) {
    const {
      limit = this.limit,
      dryRun = this.dryRun
    } = options;

    let misses = 0;
    const entries = await pMap(partitions, async partition => {
      const entry = await this.request(partition, options);
      if (!entry.hit && !dryRun) {
        misses += 1;
      }

      return entry;
    }, { concurrency: limit });

    return entries;
  }

  async request({ startKey, endKey }, options = {}) {
    const url = new URL('_all_docs', this.origin);
    if (startKey) {
      url.searchParams.set('startkey', `"${startKey}"`);
    }

    if (endKey) {
      url.searchParams.set('endkey', `"${endKey}"`);
    }

    // Always get as much as we can for each partition
    // TODO (0): when we receive 10000 rows, we should
    // surface a warning because the partition is too
    // large to be served
    url.searchParams.set('limit', 10_000);

    options.headers = {
      ...options.headers,
      'npm-replication-opt-in': 'true'
    };

    const {
      integrity,
      signal,
      staleWhileRevalidate = true
    } = options;

    const { cache = true } = options;
    signal?.throwIfAborted();

    // First, try to get from the cache before making any request.
    const key = Partition.cacheKey(startKey, endKey, this.origin);
    const buffer = cache
      ? await this.cache.fetch(key, { context: { integrity } })
      : undefined;

    const entry = buffer ? CacheEntry.decode(buffer) : undefined;
    if (entry?.valid) {
      entry.hit = true;
      return entry;
    }

    if (staleWhileRevalidate && entry?.staleWhileRevalidate) {
      // Revalidate while returning the stale entry
      register(this.cache.path(), true, url);
      return entry;
    }

    // Either no cache entry, or need to revalidate before use.
    setCacheHeaders(options, entry);
    Object.assign(options, {
      path: url.pathname.replace(/\/+$/, '') + url.search,
      ...agentOptions
    });

    options.origin = url.origin;
    options.headers = addHeader(addHeader(options.headers, 'accept-encoding', 'gzip;q=1.0, identity;q=0.5'), 'user-agent', userAgent);
    options.method = 'GET';

    console.log(`${this.origin}/_all_docs${url.search}`);
    const result = await this.#handleResponse(url, options, await this.agent.request(options));

    const { refresh = false } = options;
    if (cache || refresh) {
      this.cache.set(key, result.encode());
    }

    return result;
  }

  async #handleResponse(url, options, response) {
    const h = [];
    for (const [key, value] of Object.entries(response.headers)) {
      /* c8 ignore start - theoretical */
      if (Array.isArray(value)) {
        h.push(Buffer.from(key), Buffer.from(value.join(', ')));
        /* c8 ignore stop */
      } else if (typeof value === 'string') {
        h.push(Buffer.from(key), Buffer.from(value));
      }
    }

    const { integrity, trustIntegrity } = options;

    console.log(`${this.origin}/_all_docs${url.search} ${response.statusCode}`);
    const result = new CacheEntry(
      /* c8 ignore next - should always have a status code */
      response.statusCode || 200,
      h,
      {
        integrity,
        trustIntegrity,
        'stale-while-revalidate-factor': this.staleWhileRevalidateFactor
      }
    );

    response.body.on('data', chunk => result.addBody(chunk));
    return await new Promise((res, rej) => {
      response.body.on('error', rej);
      response.body.on('end', () => res(result));
    });
  }
}
