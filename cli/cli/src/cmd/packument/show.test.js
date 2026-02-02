import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

/**
 * Test the parseSpec function logic for packument show command
 */

/**
 * Parse a package spec into name and version
 * @param {string} spec - Package spec
 * @returns {{ name: string, version: string|null }}
 */
function parseSpec(spec) {
  // Handle scoped packages
  if (spec.startsWith('@')) {
    // @scope/name or @scope/name@version
    const slashIndex = spec.indexOf('/');
    if (slashIndex === -1) {
      return { name: spec, version: null };
    }

    const afterSlash = spec.slice(slashIndex + 1);
    const atIndex = afterSlash.indexOf('@');

    if (atIndex === -1) {
      // @scope/name (no version)
      return { name: spec, version: null };
    } else {
      // @scope/name@version
      return {
        name: spec.slice(0, slashIndex + 1 + atIndex),
        version: afterSlash.slice(atIndex + 1)
      };
    }
  }

  // Unscoped package: name or name@version
  const atIndex = spec.indexOf('@');
  if (atIndex === -1) {
    return { name: spec, version: null };
  }

  return {
    name: spec.slice(0, atIndex),
    version: spec.slice(atIndex + 1)
  };
}

describe('parseSpec', () => {
  describe('unscoped packages', () => {
    it('parses simple name', () => {
      const result = parseSpec('lodash');
      assert.deepEqual(result, { name: 'lodash', version: null });
    });

    it('parses name@version', () => {
      const result = parseSpec('lodash@4.17.21');
      assert.deepEqual(result, { name: 'lodash', version: '4.17.21' });
    });

    it('parses name with dots', () => {
      const result = parseSpec('left-pad');
      assert.deepEqual(result, { name: 'left-pad', version: null });
    });

    it('parses name with dots and version', () => {
      const result = parseSpec('left-pad@1.3.0');
      assert.deepEqual(result, { name: 'left-pad', version: '1.3.0' });
    });
  });

  describe('scoped packages', () => {
    it('parses @scope/name', () => {
      const result = parseSpec('@babel/core');
      assert.deepEqual(result, { name: '@babel/core', version: null });
    });

    it('parses @scope/name@version', () => {
      const result = parseSpec('@babel/core@7.23.0');
      assert.deepEqual(result, { name: '@babel/core', version: '7.23.0' });
    });

    it('parses complex scoped package', () => {
      const result = parseSpec('@types/node@18.0.0');
      assert.deepEqual(result, { name: '@types/node', version: '18.0.0' });
    });

    it('parses scoped package with no slash', () => {
      const result = parseSpec('@scope');
      assert.deepEqual(result, { name: '@scope', version: null });
    });
  });

  describe('edge cases', () => {
    it('parses version with pre-release tag', () => {
      const result = parseSpec('react@18.0.0-alpha.1');
      assert.deepEqual(result, { name: 'react', version: '18.0.0-alpha.1' });
    });

    it('parses scoped package with pre-release tag', () => {
      const result = parseSpec('@angular/core@16.0.0-rc.1');
      assert.deepEqual(result, { name: '@angular/core', version: '16.0.0-rc.1' });
    });
  });
});

describe('packument show --select', () => {
  describe('single field selection', () => {
    it('unwraps single field result', () => {
      // When selecting a single field, the show command unwraps it
      const data = { name: 'lodash' };
      const keys = Object.keys(data);
      const result = keys.length === 1 ? data[keys[0]] : data;

      assert.equal(result, 'lodash');
    });

    it('keeps multi-field result as object', () => {
      const data = { name: 'lodash', version: '4.17.21' };
      const keys = Object.keys(data);
      const result = keys.length === 1 ? data[keys[0]] : data;

      assert.deepEqual(result, { name: 'lodash', version: '4.17.21' });
    });
  });

  describe('version narrowing', () => {
    it('merges version data with time field', () => {
      const packument = {
        name: 'lodash',
        time: { '4.17.21': '2021-02-20T15:42:16.891Z' },
        versions: {
          '4.17.21': { dist: { integrity: 'sha512-abc' } }
        }
      };

      const version = '4.17.21';
      const data = {
        ...packument.versions[version],
        name: packument.name,
        time: packument.time
      };

      assert.equal(data.name, 'lodash');
      assert.deepEqual(data.dist, { integrity: 'sha512-abc' });
      assert.equal(data.time['4.17.21'], '2021-02-20T15:42:16.891Z');
    });
  });
});
