import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  parseAddExpression,
  extractValue,
  evaluateSelector
} from './enrich.js';

describe('parseAddExpression', () => {
  it('parses simple selector with alias', () => {
    const result = parseAddExpression('time as publishTime');
    assert.deepEqual(result, {
      selector: 'time',
      alias: 'publishTime'
    });
  });

  it('parses bracket notation selector', () => {
    const result = parseAddExpression('time[.version] as addedAt');
    assert.deepEqual(result, {
      selector: 'time[.version]',
      alias: 'addedAt'
    });
  });

  it('parses nested selector with brackets', () => {
    const result = parseAddExpression('versions[.version].dist.integrity as integrity');
    assert.deepEqual(result, {
      selector: 'versions[.version].dist.integrity',
      alias: 'integrity'
    });
  });

  it('throws on missing alias', () => {
    assert.throws(() => {
      parseAddExpression('time');
    }, /Expected: <selector> as <alias>/);
  });

  it('throws on invalid format', () => {
    assert.throws(() => {
      parseAddExpression('');
    }, /Invalid --add expression/);
  });

  it('handles spaces around as keyword', () => {
    const result = parseAddExpression('time   as   alias');
    assert.deepEqual(result, {
      selector: 'time',
      alias: 'alias'
    });
  });
});

describe('evaluateSelector', () => {
  it('evaluates simple field access', () => {
    const obj = { name: 'lodash' };
    assert.equal(evaluateSelector(obj, 'name'), 'lodash');
  });

  it('evaluates nested field access', () => {
    const obj = { time: { modified: '2024-01-01' } };
    assert.equal(evaluateSelector(obj, 'time.modified'), '2024-01-01');
  });

  it('evaluates bracket notation with quotes', () => {
    const obj = { time: { '4.17.21': '2021-02-20' } };
    assert.equal(evaluateSelector(obj, 'time["4.17.21"]'), '2021-02-20');
  });

  it('evaluates mixed dot and bracket notation', () => {
    const obj = {
      versions: {
        '1.0.0': {
          dist: { integrity: 'sha512-abc' }
        }
      }
    };
    assert.equal(
      evaluateSelector(obj, 'versions["1.0.0"].dist.integrity'),
      'sha512-abc'
    );
  });

  it('evaluates numeric bracket notation', () => {
    const obj = { items: ['first', 'second', 'third'] };
    assert.equal(evaluateSelector(obj, 'items[0]'), 'first');
  });

  it('returns null for missing field', () => {
    const obj = { name: 'lodash' };
    assert.equal(evaluateSelector(obj, 'missing'), null);
  });

  it('returns null for nested missing field', () => {
    const obj = { time: {} };
    assert.equal(evaluateSelector(obj, 'time.modified'), null);
  });

  it('returns null when traversing through null', () => {
    const obj = { parent: null };
    assert.equal(evaluateSelector(obj, 'parent.child'), null);
  });
});

describe('extractValue', () => {
  it('resolves .field reference from record', () => {
    const packument = {
      time: { '4.17.21': '2021-02-20T15:42:16.891Z' }
    };
    const record = { version: '4.17.21' };

    const result = extractValue(packument, 'time[.version]', record);
    assert.equal(result, '2021-02-20T15:42:16.891Z');
  });

  it('resolves multiple .field references', () => {
    const packument = {
      data: {
        npm: { count: 100 }
      }
    };
    const record = { registry: 'npm' };

    const result = extractValue(packument, 'data[.registry].count', record);
    assert.equal(result, 100);
  });

  it('resolves nested .field access', () => {
    const packument = {
      versions: {
        '1.0.0': { dist: { integrity: 'sha512-abc' } }
      }
    };
    const record = { version: '1.0.0' };

    const result = extractValue(
      packument,
      'versions[.version].dist.integrity',
      record
    );
    assert.equal(result, 'sha512-abc');
  });

  it('handles missing .field value', () => {
    const packument = { time: {} };
    const record = {}; // No version field

    const result = extractValue(packument, 'time[.version]', record);
    assert.equal(result, null);
  });

  it('handles special characters in .field value', () => {
    const packument = {
      time: { '@scope/pkg@1.0.0': '2024-01-01' }
    };
    const record = { spec: '@scope/pkg@1.0.0' };

    const result = extractValue(packument, 'time[.spec]', record);
    assert.equal(result, '2024-01-01');
  });

  it('evaluates static selector without .field', () => {
    const packument = { name: 'lodash' };
    const record = {};

    const result = extractValue(packument, 'name', record);
    assert.equal(result, 'lodash');
  });
});

describe('enrichment flow', () => {
  it('enriches record with packument data', () => {
    const packument = {
      name: 'lodash',
      time: { '4.17.21': '2021-02-20T15:42:16.891Z' },
      versions: {
        '4.17.21': { dist: { integrity: 'sha512-abc' } }
      }
    };

    const record = { name: 'lodash', version: '4.17.21' };

    // Simulate enrichment
    const enrichments = [
      parseAddExpression('time[.version] as addedAt'),
      parseAddExpression('versions[.version].dist.integrity as integrity')
    ];

    for (const enrichment of enrichments) {
      record[enrichment.alias] = extractValue(
        packument,
        enrichment.selector,
        record
      );
    }

    assert.equal(record.addedAt, '2021-02-20T15:42:16.891Z');
    assert.equal(record.integrity, 'sha512-abc');
    assert.equal(record.name, 'lodash');
    assert.equal(record.version, '4.17.21');
  });

  it('handles missing packument with null values', () => {
    const record = { name: 'unknown', version: '1.0.0' };

    const enrichments = [
      parseAddExpression('time[.version] as addedAt')
    ];

    // When packument is null, add null values
    for (const enrichment of enrichments) {
      record[enrichment.alias] = null;
    }

    assert.equal(record.addedAt, null);
    assert.equal(record.name, 'unknown');
  });
});
