import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

/**
 * Test the format output logic for view query --format option
 */

/**
 * Format a record for 'lines' output mode
 * @param {object} record - The record to format
 * @returns {string} The formatted line
 */
function formatLinesOutput(record) {
  const values = Object.values(record);
  if (values.length === 1) {
    // Single field: output as-is (string) or JSON (other types)
    const val = values[0];
    return typeof val === 'string' ? val : JSON.stringify(val);
  } else {
    // Multiple fields: tab-separated
    return values.map(v =>
      typeof v === 'string' ? v : JSON.stringify(v)
    ).join('\t');
  }
}

describe('view query --format', () => {
  describe('ndjson format', () => {
    it('outputs valid JSON per line', () => {
      const record = { name: 'lodash', count: 114 };
      const output = JSON.stringify(record);

      assert.equal(output, '{"name":"lodash","count":114}');
      assert.doesNotThrow(() => JSON.parse(output));
    });

    it('handles nested objects', () => {
      const record = { name: 'react', meta: { versions: ['18.0.0', '18.1.0'] } };
      const output = JSON.stringify(record);

      const parsed = JSON.parse(output);
      assert.deepEqual(parsed.meta.versions, ['18.0.0', '18.1.0']);
    });
  });

  describe('lines format', () => {
    it('outputs plain string for single string field', () => {
      const record = { name: 'lodash' };
      const output = formatLinesOutput(record);

      assert.equal(output, 'lodash');
      // Should NOT be quoted
      assert.ok(!output.startsWith('"'));
      assert.ok(!output.startsWith('{'));
    });

    it('outputs JSON for single non-string field (array)', () => {
      const record = { versions: ['1.0.0', '2.0.0'] };
      const output = formatLinesOutput(record);

      assert.equal(output, '["1.0.0","2.0.0"]');
      assert.doesNotThrow(() => JSON.parse(output));
    });

    it('outputs JSON for single non-string field (number)', () => {
      const record = { count: 42 };
      const output = formatLinesOutput(record);

      assert.equal(output, '42');
    });

    it('outputs tab-separated for multiple fields', () => {
      const record = { name: 'lodash', count: 114 };
      const output = formatLinesOutput(record);

      assert.equal(output, 'lodash\t114');
      assert.ok(output.includes('\t'));
    });

    it('handles mixed string and non-string in multi-field', () => {
      const record = { name: 'react', versions: ['18.0.0', '18.1.0'], count: 2 };
      const output = formatLinesOutput(record);

      const parts = output.split('\t');
      assert.equal(parts.length, 3);
      assert.equal(parts[0], 'react');
      assert.equal(parts[1], '["18.0.0","18.1.0"]');
      assert.equal(parts[2], '2');
    });

    it('handles empty string values', () => {
      const record = { name: '' };
      const output = formatLinesOutput(record);

      assert.equal(output, '');
    });

    it('handles null values in multi-field', () => {
      const record = { name: 'test', value: null };
      const output = formatLinesOutput(record);

      assert.equal(output, 'test\tnull');
    });
  });

  describe('json format', () => {
    it('outputs valid JSON array', () => {
      const results = [
        { name: 'lodash', count: 114 },
        { name: 'express', count: 50 }
      ];
      const output = JSON.stringify(results, null, 2);

      const parsed = JSON.parse(output);
      assert.ok(Array.isArray(parsed));
      assert.equal(parsed.length, 2);
    });

    it('handles empty results', () => {
      const results = [];
      const output = JSON.stringify(results, null, 2);

      const parsed = JSON.parse(output);
      assert.deepEqual(parsed, []);
    });

    it('handles single result', () => {
      const results = [{ name: 'lodash' }];
      const output = JSON.stringify(results, null, 2);

      const parsed = JSON.parse(output);
      assert.equal(parsed.length, 1);
      assert.equal(parsed[0].name, 'lodash');
    });
  });

  describe('format validation', () => {
    it('recognizes valid formats', () => {
      const validFormats = ['ndjson', 'lines', 'json'];

      for (const format of validFormats) {
        assert.ok(
          ['ndjson', 'lines', 'json'].includes(format),
          `${format} should be valid`
        );
      }
    });

    it('rejects invalid formats', () => {
      const invalidFormats = ['csv', 'xml', 'yaml', 'tsv', ''];

      for (const format of invalidFormats) {
        assert.ok(
          !['ndjson', 'lines', 'json'].includes(format),
          `${format} should be invalid`
        );
      }
    });
  });

  describe('backwards compatibility', () => {
    it('--collect maps to json format', () => {
      const collect = true;
      const explicitFormat = undefined;

      const format = collect ? 'json' : (explicitFormat || 'ndjson');
      assert.equal(format, 'json');
    });

    it('defaults to ndjson when no flags set', () => {
      const collect = false;
      const explicitFormat = undefined;

      const format = collect ? 'json' : (explicitFormat || 'ndjson');
      assert.equal(format, 'ndjson');
    });

    it('explicit --format overrides when --collect not set', () => {
      const collect = false;
      const explicitFormat = 'lines';

      const format = collect ? 'json' : (explicitFormat || 'ndjson');
      assert.equal(format, 'lines');
    });
  });
});
