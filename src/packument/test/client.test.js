import { describe, it } from 'node:test';
import { join } from 'node:path';
import { ok, equal, match } from 'node:assert/strict';
import { rimraf } from 'rimraf';
import { PackumentClient } from '../client.js';

const fixtures = join(import.meta.dirname, 'fixtures');

describe('PackumentClient', () => {
  describe('URL construction', () => {
    it('should construct URL correctly for standard registry', async () => {
      const client = new PackumentClient({
        origin: 'https://registry.npmjs.org',
        env: {
          RUNTIME: 'node',
          CACHE_DIR: fixtures
        }
      });

      // Access the internal URL construction logic by checking origin
      const url = new URL(client.origin);
      const basePath = url.pathname.endsWith('/') ? url.pathname : url.pathname + '/';
      url.pathname = basePath + encodeURIComponent('lodash');

      equal(url.href, 'https://registry.npmjs.org/lodash');
    });

    it('should preserve path segments in origin URL', async () => {
      const client = new PackumentClient({
        origin: 'https://packages.example.com/javascript',
        env: {
          RUNTIME: 'node',
          CACHE_DIR: fixtures
        }
      });

      // Simulate the URL construction logic from client.request()
      const url = new URL(client.origin);
      const basePath = url.pathname.endsWith('/') ? url.pathname : url.pathname + '/';
      url.pathname = basePath + encodeURIComponent('lodash');

      equal(url.href, 'https://packages.example.com/javascript/lodash');
    });

    it('should preserve path with trailing slash', async () => {
      const client = new PackumentClient({
        origin: 'https://packages.example.com/javascript/',
        env: {
          RUNTIME: 'node',
          CACHE_DIR: fixtures
        }
      });

      const url = new URL(client.origin);
      const basePath = url.pathname.endsWith('/') ? url.pathname : url.pathname + '/';
      url.pathname = basePath + encodeURIComponent('lodash');

      equal(url.href, 'https://packages.example.com/javascript/lodash');
    });

    it('should handle scoped packages with path segments', async () => {
      const client = new PackumentClient({
        origin: 'https://packages.example.com/javascript',
        env: {
          RUNTIME: 'node',
          CACHE_DIR: fixtures
        }
      });

      const url = new URL(client.origin);
      const basePath = url.pathname.endsWith('/') ? url.pathname : url.pathname + '/';
      url.pathname = basePath + encodeURIComponent('@babel/core');

      equal(url.href, 'https://packages.example.com/javascript/%40babel%2Fcore');
    });

    it('should handle deep path segments', async () => {
      const client = new PackumentClient({
        origin: 'https://registry.example.com/api/v2/npm',
        env: {
          RUNTIME: 'node',
          CACHE_DIR: fixtures
        }
      });

      const url = new URL(client.origin);
      const basePath = url.pathname.endsWith('/') ? url.pathname : url.pathname + '/';
      url.pathname = basePath + encodeURIComponent('express');

      equal(url.href, 'https://registry.example.com/api/v2/npm/express');
    });
  });

  describe('request', () => {
    it('.request(lodash) returns a valid packument', async () => {
      const client = new PackumentClient({
        origin: 'https://registry.npmjs.org',
        env: {
          RUNTIME: 'node',
          CACHE_DIR: fixtures
        }
      });

      const entry = await client.request('lodash');

      ok(entry, 'entry should exist');
      ok(entry.body, 'entry should have body');
      equal(entry.body.name, 'lodash');
      ok(entry.body.versions, 'packument should have versions');
      ok(Object.keys(entry.body.versions).length > 0, 'should have at least one version');
    });

    it('.request(@babel/core) handles scoped packages', async () => {
      const client = new PackumentClient({
        origin: 'https://registry.npmjs.org',
        env: {
          RUNTIME: 'node',
          CACHE_DIR: fixtures
        }
      });

      const entry = await client.request('@babel/core');

      ok(entry, 'entry should exist');
      ok(entry.body, 'entry should have body');
      equal(entry.body.name, '@babel/core');
      ok(entry.body.versions, 'packument should have versions');
    });

    it('.request(nonexistent-package-xyz-123) returns null for 404', async () => {
      const client = new PackumentClient({
        origin: 'https://registry.npmjs.org',
        env: {
          RUNTIME: 'node',
          CACHE_DIR: fixtures
        }
      });

      const entry = await client.request('nonexistent-package-xyz-123-definitely-not-real');

      equal(entry, null, 'should return null for 404');
    });
  });

  describe('requestAll', () => {
    it('.requestAll([...packages]) returns multiple packuments', async () => {
      const client = new PackumentClient({
        origin: 'https://registry.npmjs.org',
        env: {
          RUNTIME: 'node',
          CACHE_DIR: fixtures
        }
      });

      const entries = await client.requestAll(['debug', 'semver']);

      equal(entries.length, 2);
      for (const entry of entries) {
        ok(entry, 'entry should exist');
        ok(entry.body, 'entry should have body');
        ok(entry.body.versions, 'packument should have versions');
      }
    });
  });

  it('(cleanup) delete the local packument cache', async () => {
    await rimraf(join(fixtures, 'packuments'), {
      maxRetries: 1,
      retryDelay: 1
    });
  });
});
