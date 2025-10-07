import { CacheEntry, createPartitionKey, decodeCacheKey } from '@_all_docs/cache';

const kCustomInspect = Symbol.for('nodejs.util.inspect.custom');

export class Partition {
  #rows = [];
  #key = null;

  constructor({ startKey, endKey, origin, rows }) {
    this.startKey = startKey;
    this.endKey = endKey;
    this.origin = origin;

    this.#rows = rows || [];
    this.#key = createPartitionKey(startKey, endKey, origin);
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
    return createPartitionKey(startKey, endKey, origin);
  }

  static fromURL(u) {
    const url = new URL.URL(u);
    const { searchParams } = url;

    const startKey = searchParams.get('startkey');
    const endKey = searchParams.get('endkey');
    const { origin } = url;

    return new Partition({ startKey, endKey, origin });
  }

  static fromCacheKey(key) {
    const decoded = decodeCacheKey(key);
    if (decoded.type !== 'partition') {
      throw new Error(`Invalid cache key type: ${decoded.type}`);
    }

    return new Partition({
      startKey: decoded.startKey,
      endKey: decoded.endKey,
      origin: decoded.origin
    });
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