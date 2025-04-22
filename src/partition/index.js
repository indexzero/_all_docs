import URL from 'node:url';

import { CacheEntry } from '@vltpkg/registry-client';

import { AllDocsPartitionClient } from './client.js';
import { PartitionSet } from './set.js';

class Partition {
  #rows = [];
  #raw = [];
  #key = null;

  constructor({ startKey, endKey, origin, rows }) {
    this.startKey = startKey;
    this.endKey = endKey;
    this.#rows = rows || [];

    this.#raw = [
      origin,
      // TODO (0): Remove unnecessary strings here
      'GET', '_all_docs', 'startkey',
      startKey,
      // TODO (0): Remove unnecessary strings here
      'endkey',
      endKey
    ];

    this.#key = JSON.stringify(this.#raw);
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

  static fromURL(u) {
    const url = new URL.URL(u);
    const { searchParams } = url;

    const startKey = searchParams.get('startkey');
    const endKey = searchParams.get('endkey');
    const origin = url.origin;

    return new Partition({ startKey, endKey, origin });
  }

  static fromCacheKey(key) {
    const where = JSON.parse(key);

    const origin = where[0];
    const startKey = where[4];
    const endKey = where[6];

    return new Partition({ startKey, endKey, origin });
  }

  static fromCacheWalk([key, val]) {
    const p = Partition.fromCacheKey(key);

    const entry = CacheEntry.decode(val);
    const body = entry.json();
    p.rows = body.rows;

    return p;
  }
}

export {
  AllDocsPartitionClient,
  Partition,
  PartitionSet
}
