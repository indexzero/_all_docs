import { Partition } from './partition.js';

export class PartitionSet {
  #map = new Map();

  constructor(iterable = []) {
    for (const item of iterable) {
      this.add(item);
    }
  }

  add(partition) {
    this.#map.set(partition.key, partition);
    return this;
  }

  has(partition) {
    return this.#map.has(partition.key);
  }

  delete(partition) {
    return this.#map.delete(partition.key);
  }

  get size() {
    return this.#map.size;
  }

  [Symbol.iterator]() {
    return this.#map.values();
  }

  toArray() {
    return [...this];
  }

  map(fn) {
    return new PartitionSet(this.toArray().map(fn));
  }

  filter(fn) {
    return new PartitionSet(this.toArray().filter(fn));
  }

  toString() {
    return `PartitionSet(${[...this].join(', ')})`;
  }

  static fromPivots(origin, pivots) {
    return new PartitionSet(
      pivots.slice(0, -1).map((startKey, i) => {
        const endKey = pivots[i + 1];
        return new Partition({ startKey, endKey, origin });
      })
    );
  }
}
