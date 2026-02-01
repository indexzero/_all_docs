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

    it('should handle custom origins with readable format', () => {
      const key = createPartitionKey('a', 'b', 'https://packages.example.com/javascript');
      const decoded = decodeCacheKey(key);

      // Decoded origin is best-effort reconstruction from truncated segments
      assert.ok(decoded.origin.includes('paces.exale.com'));
      assert.ok(decoded.origin.includes('javpt'));
    });

    it('should handle legacy base64 origin keys', () => {
      // Simulate decoding an old-format key by calling decodeCacheKey directly
      // Old keys had base64 origins like 'aHR0cHM6' that can't contain '.' or '~'
      const legacyKey = 'v1:packument:aHR0cHM6:657870726573';
      const decoded = decodeCacheKey(legacyKey);

      assert.ok(decoded.origin.startsWith('<legacy:'));
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

  describe('origin encoding scheme', () => {
    it('should use npm alias for npm registries', () => {
      const key1 = createPackumentKey('test', 'https://registry.npmjs.com');
      const key2 = createPackumentKey('test', 'https://registry.npmjs.org');
      const key3 = createPackumentKey('test', 'https://replicate.npmjs.com');

      assert.ok(key1.includes(':npm:'));
      assert.ok(key2.includes(':npm:'));
      assert.ok(key3.includes(':npm:'));
    });

    it('should truncate segments: <=5 chars kept whole, else first 3 + last 2', () => {
      // 'packages' (8 chars) -> 'pac' + 'es' = 'paces'
      // 'example' (7 chars) -> 'exa' + 'le' = 'exale'
      // 'com' (3 chars) -> 'com'
      // 'javascript' (10 chars) -> 'jav' + 'pt' = 'javpt'
      const key = createPackumentKey('test', 'https://packages.example.com/javascript');
      assert.ok(key.includes(':paces.exale.com~javpt:'));
    });

    it('should handle http protocol with prefix', () => {
      const key = createPackumentKey('test', 'http://localhost:4873');
      assert.ok(key.includes(':http~locst~4873:'));
    });

    it('should handle multiple path segments', () => {
      const key = createPackumentKey('test', 'https://mycompany.jfrog.io/artifactory/api/npm/npm-local');
      // mycompany -> mycom + 'ny' = myany? No wait: first 3 + last 2 = 'myc' + 'ny' = 'mycny'
      // Actually: 'mycompany' is 9 chars -> 'myc' + 'ny' = 'mycny'
      // 'jfrog' is 5 chars -> 'jfrog'
      // 'artifactory' is 11 chars -> 'art' + 'ry' = 'artry'
      // 'api' is 3 chars -> 'api'
      // 'npm' is 3 chars -> 'npm'
      // 'npm-local' is 9 chars -> 'npm' + 'al' = 'npmal'
      assert.ok(key.includes('mycny.jfrog.io~artry~api~npm~npmal'));
    });

    it('should handle bare hostnames by assuming https', () => {
      const key = createPackumentKey('test', 'my-registry.com');
      assert.ok(key.includes(':my-ry.com:'));
    });

    it('should omit default ports', () => {
      const key1 = createPackumentKey('test', 'https://example.com:443');
      const key2 = createPackumentKey('test', 'http://example.com:80');

      // Should not contain port numbers for default ports
      assert.ok(!key1.includes('443'));
      assert.ok(!key2.includes('80'));
    });

    it('should preserve non-default ports', () => {
      const key = createPackumentKey('test', 'https://example.com:8443');
      assert.ok(key.includes('~8443'));
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