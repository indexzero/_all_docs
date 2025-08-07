import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  createPartitionKey,
  createPackumentKey,
  createCacheKey,
  decodeCacheKey
} from '../cache-key.js';

describe('Cache Key Utilities', () => {
  describe('createPartitionKey', () => {
    it('should create versioned partition key with default origin', () => {
      const key = createPartitionKey('a', 'b');
      assert.ok(key.startsWith('v1:partition:npm:'));
      assert.ok(key.includes(':61:')); // 'a' in hex
      assert.ok(key.includes(':62')); // 'b' in hex
    });

    it('should create partition key with custom origin', () => {
      const key = createPartitionKey('start', 'end', 'https://custom.registry.com');
      assert.ok(key.startsWith('v1:partition:'));
      assert.ok(!key.includes(':npm:'));
    });

    it('should handle empty keys', () => {
      const key = createPartitionKey('', 'z');
      assert.ok(key.includes('::7a')); // empty:z
    });

    it('should handle special characters', () => {
      const key = createPartitionKey('@scope/pkg', '@scope/pkh');
      assert.ok(key.includes('4073636f70652f706b67')); // @scope/pkg in hex
    });
  });

  describe('createPackumentKey', () => {
    it('should create versioned packument key with default origin', () => {
      const key = createPackumentKey('express');
      assert.ok(key.startsWith('v1:packument:npm:'));
      assert.ok(key.includes(':657870726573')); // 'express' in hex
    });

    it('should create packument key with custom origin', () => {
      const key = createPackumentKey('lodash', 'https://custom.npm.org');
      assert.ok(key.startsWith('v1:packument:'));
      assert.ok(!key.includes(':npm:'));
    });

    it('should handle scoped packages', () => {
      const key = createPackumentKey('@babel/core');
      assert.ok(key.includes('40626162656c2f636f7265')); // @babel/core in hex
    });
  });

  describe('createCacheKey factory', () => {
    it('should create partition keys', () => {
      const key = createCacheKey('partition', {
        startKey: 'x',
        endKey: 'y',
        origin: 'https://registry.npmjs.com'
      });
      
      assert.ok(key.startsWith('v1:partition:'));
    });

    it('should create packument keys', () => {
      const key = createCacheKey('packument', {
        packageName: 'react',
        origin: 'https://registry.npmjs.com'
      });
      
      assert.ok(key.startsWith('v1:packument:'));
    });

    it('should throw on unknown type', () => {
      assert.throws(() => {
        createCacheKey('unknown', {});
      }, /Unknown cache key type: unknown/);
    });
  });

  describe('decodeCacheKey', () => {
    it('should decode partition key', () => {
      const key = createPartitionKey('hello', 'world', 'https://registry.npmjs.com');
      const decoded = decodeCacheKey(key);
      
      assert.equal(decoded.version, 'v1');
      assert.equal(decoded.type, 'partition');
      assert.equal(decoded.startKey, 'hello');
      assert.equal(decoded.endKey, 'world');
      assert.equal(decoded.origin, 'https://registry.npmjs.com');
    });

    it('should decode packument key', () => {
      const key = createPackumentKey('vue', 'https://registry.npmjs.com');
      const decoded = decodeCacheKey(key);
      
      assert.equal(decoded.version, 'v1');
      assert.equal(decoded.type, 'packument');
      assert.equal(decoded.packageName, 'vue');
      assert.equal(decoded.origin, 'https://registry.npmjs.com');
    });

    it('should handle custom origins as lossy', () => {
      const key = createPartitionKey('a', 'b', 'https://very-long-custom-registry.example.com');
      const decoded = decodeCacheKey(key);
      
      assert.ok(decoded.origin.startsWith('<custom:'));
    });

    it('should throw on invalid format', () => {
      assert.throws(() => {
        decodeCacheKey('invalid:key');
      }, /Invalid cache key format/);
    });

    it('should throw on unknown type', () => {
      assert.throws(() => {
        decodeCacheKey('v1:unknown:npm:data');
      }, /Unknown cache key type/);
    });
  });

  describe('hex encoding edge cases', () => {
    it('should handle unicode correctly', () => {
      const key = createPackumentKey('😀emoji');
      const decoded = decodeCacheKey(key);
      assert.equal(decoded.packageName, '😀emoji');
    });

    it('should handle null bytes', () => {
      const key = createPackumentKey('before\x00after');
      const decoded = decodeCacheKey(key);
      assert.equal(decoded.packageName, 'before\x00after');
    });

    it('should round-trip complex strings', () => {
      const complexString = '@org/pkg-name_v1.2.3~beta+build';
      const key = createPackumentKey(complexString);
      const decoded = decodeCacheKey(key);
      assert.equal(decoded.packageName, complexString);
    });
  });
});