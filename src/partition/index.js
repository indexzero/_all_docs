import { basename } from 'path';
import URL from 'node:url';

import { CacheEntry } from '@vltpkg/registry-client';

class Partition {
  #rows = [];

  constructor({ startKey, endKey, dirname, rows }) {
    this.startKey = startKey;
    this.endKey = endKey;
    this.id = `${startKey}___${endKey}`;
    this.dirname = dirname;
    this.filename = `${this.id}.json`;
    this.#rows = rows || [];
  }

  get rows() {
    return this.#rows;
  }

  set rows(rows) {
    this.#rows = rows;
  }

  async read(source) {
    const fullpath = join(source ?? this.dirname, this.filename);
    const text = await readFile(fullpath, 'utf8');
    const _all_docs = JSON.parse(text);
    this.#rows = _all_docs.rows;
  }

  async readSync(source) {
    const fullpath = join(source ?? this.dirname, this.filename);
    const text = readFileSync(fullpath, 'utf8');
    const _all_docs = JSON.parse(text);
    this.#rows = _all_docs.rows;
  }

  static fromURL(u) {
    const where = new URL(u);

    const startKey = where.searchParams.get('start_key');
    const endKey = where.searchParams.get('end_key');

    return new Partition({ startKey, endKey });
  }

  static fromCacheWalk([key, val]) {
    const p = Partition.fromURL(key);

    const entry = CacheEntry.decode(val);
    p.rows = entry.json();

    return p;
  }

  /**
   * Converts a filename into a Partition object.
   * @param {string} filename
   * @returns {Partition}
   */
  static fromFilename(filename) {
    const id = basename(filename, '.json');
    const [startKey, endKey] = id.split('___');
    return new Partition({ startKey, endKey });
  }

  static fromPivots(pivots) {
    return pivots.map((startKey, i) => {
      const endKey = pivots[i + 1];
      return endKey
        ? new Partition({ startKey, endKey })
        : null;
    }).filter(Boolean);
  }
}

export {
  Partition
}
