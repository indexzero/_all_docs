import { CacheEntry } from '@vltpkg/registry-client';

const kCustomInspect = Symbol.for('nodejs.util.inspect.custom');

class Partition {
  #rows = [];
  #key = null;

  constructor({ startKey, endKey, origin, rows }) {
    this.startKey = startKey;
    this.endKey = endKey;
    this.origin = origin;

    this.#rows = rows || [];
    this.#key = Partition.cacheKey(startKey, endKey, origin);
  }

  get rows() {
    return this.#rows;
  }

  set rows(rows) {
    this.#rows = rows;
  }

  get key() {
    return this.#key;
  }

  get [Symbol.toStringTag]() {
    return '@_all_docs/Partition';
  }

  [kCustomInspect]() {
    return `${this[Symbol.toStringTag]} {
  startKey: ${this.startKey},
  endKey: ${this.endKey},
  origin: ${this.origin},
  key: ${this.#key},
  rows: ${this.#rows.length}
}`;
  }

  static cacheKey(startKey, endKey, origin = 'https://replicate.npmjs.com') {
    const url = new URL('_all_docs', origin);

    if (startKey) {
      url.searchParams.set('startkey', `"${startKey}"`);
    }

    if (endKey) {
      url.searchParams.set('endkey', `"${endKey}"`);
    }

    return JSON.stringify([
      `${url}`,
      startKey,
      endKey
    ]);
  }

  static fromURL(u) {
    const url = new URL.URL(u);
    const { searchParams } = url;

    const startKey = searchParams.get('startkey');
    const endKey = searchParams.get('endkey');
    const {origin} = url;

    return new Partition({ startKey, endKey, origin });
  }

  static fromCacheKey(key) {
    const [url, startKey, endKey] = JSON.parse(key);
    const { origin } = new URL(url);

    return new Partition({ startKey, endKey, origin });
  }

  static fromCacheEntry([key, val]) {
    const p = Partition.fromCacheKey(key);

    // TODO (0): include all CacheEntry metadata (e.g. headers, etc)
    const entry = CacheEntry.decode(val);
    const body = entry.json();
    p.rows = body.rows;

    return p;
  }
}

export {

  Partition

};
export {PartitionSet} from './set.js';
export {PartitionClient} from './client.js';
