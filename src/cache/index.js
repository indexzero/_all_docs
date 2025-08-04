import { Cache as HttpBufferCache } from '@vltpkg/cache';

// Remark (0): we may be able to get what we need from `lru-cache` but
// using `@vltpkg/cache` for now to avoid having to reimplement the wheel
class Cache extends HttpBufferCache {
  constructor(options) {
    super(options);
  }

  map(fn) {
    const frame = this;
    return {
      * [Symbol.iterator]() {
        for (const entry of frame) {
          yield fn(entry);
        }
      },

      async * [Symbol.asyncIterator]() {
        for await (const entry of frame) {
          yield fn(entry);
        }
      }
    };
  }
}

export {
  Cache
};
