import { pMapIterable } from 'p-map';
import { Cache } from '@_all_docs/cache';
import { Partition } from '@_all_docs/partition';
import { Packument } from '@_all_docs/packument';

class Frame {
  #options = {};

  constructor(iterable, options = {}) {
    if (
      !iterable
      || (typeof iterable[Symbol.iterator] !== 'function'
        && typeof iterable[Symbol.asyncIterator] !== 'function')
    ) {
      throw new TypeError('Provided value is not iterable');
    }

    this.iterable = iterable;
    this.configure(options);
  }

  configure(options) {
    this.#options = {
      ...this.#options,
      ...options
    };
  }

  [Symbol.iterator]() {
    return this.iterable[Symbol.iterator]();
  }

  [Symbol.asyncIterator]() {
    if (typeof this.iterable[Symbol.asyncIterator] === 'function') {
      return this.iterable[Symbol.asyncIterator]();
    }

    const iterator = this.iterable[Symbol.iterator]();
    return {
      next() {
        return Promise.resolve(iterator.next());
      },
      [Symbol.asyncIterator]() {
        return this;
      }
    };
  }

  // This may need to be in its own module for mixins
  map(fn, options) {
    // eslint-disable-next-line unicorn/no-this-assignment
    const frame = this;
    return {
      * [Symbol.iterator]() {
        for (const entry of frame) {
          yield fn(entry);
        }
      },

      ...pMapIterable(frame, fn, options)
    };
  }

  reduce(fn, initialValue) {
    let accumulator = initialValue;
    for (const entry of this) {
      accumulator = fn(accumulator, entry);
    }

    return accumulator;
  }

  async reduceAsync(fn, initialValue) {
    let accumulator = initialValue;
    for await (const entry of this) {
      accumulator = fn(accumulator, entry);
    }

    return accumulator;
  }

  filter(fn) {
    // eslint-disable-next-line unicorn/no-this-assignment
    const frame = this;
    return {
      * [Symbol.iterator]() {
        for (const entry of frame) {
          if (fn(entry)) {
            yield entry;
          }
        }
      },

      async * [Symbol.asyncIterator]() {
        for await (const entry of frame) {
          if (fn(entry)) {
            yield entry;
          }
        }
      }
    };
  }
}

class PackumentFrame extends Frame {
  static fromCache(path, driver) {
    return new PackumentFrame(
      new Cache({ path, driver })
        .map(Packument.fromCacheEntry)
    );
  }
}

class PartitionFrame extends Frame {
  static fromCache(path, driver) {
    return new PartitionFrame(
      new Cache({ path, driver })
        .map(Partition.fromCacheEntry)
    );
  }
}

export { PackumentFrame,
  PartitionFrame };

