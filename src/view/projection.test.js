import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  compileSelector,
  compileFilter,
  createProjection,
  createFilter
} from './projection.js';

describe('compileSelector', () => {
  test('returns identity function for null/undefined', () => {
    const fn = compileSelector(null);
    const obj = { name: 'test', value: 42 };
    assert.deepStrictEqual(fn(obj), obj);
  });

  test('selects simple fields', () => {
    const fn = compileSelector('name, version');
    const result = fn({ name: 'lodash', version: '4.17.21', extra: 'ignored' });

    assert.deepStrictEqual(result, { name: 'lodash', version: '4.17.21' });
  });

  test('selects nested fields', () => {
    const fn = compileSelector('name, time.modified');
    const result = fn({
      name: 'lodash',
      time: { created: '2020-01-01', modified: '2024-01-01' }
    });

    assert.deepStrictEqual(result, { name: 'lodash', modified: '2024-01-01' });
  });

  test('applies transforms', () => {
    const fn = compileSelector('versions|keys');
    const result = fn({
      versions: { '1.0.0': {}, '2.0.0': {}, '3.0.0': {} }
    });

    assert.deepStrictEqual(result, { versions_keys: ['1.0.0', '2.0.0', '3.0.0'] });
  });

  test('applies multiple transforms', () => {
    const fn = compileSelector('versions|keys|length');
    const result = fn({
      versions: { '1.0.0': {}, '2.0.0': {}, '3.0.0': {} }
    });

    assert.deepStrictEqual(result, { versions_length: 3 });
  });

  test('uses aliases', () => {
    const fn = compileSelector('versions|keys as version_list');
    const result = fn({
      versions: { '1.0.0': {}, '2.0.0': {} }
    });

    assert.deepStrictEqual(result, { version_list: ['1.0.0', '2.0.0'] });
  });

  test('handles null values gracefully', () => {
    const fn = compileSelector('name, missing|keys');
    const result = fn({ name: 'test' });

    assert.deepStrictEqual(result, { name: 'test', missing_keys: [] });
  });
});

describe('transforms', () => {
  test('keys transform', () => {
    const fn = compileSelector('data|keys');
    assert.deepStrictEqual(fn({ data: { a: 1, b: 2 } }), { data_keys: ['a', 'b'] });
  });

  test('values transform', () => {
    const fn = compileSelector('data|values');
    assert.deepStrictEqual(fn({ data: { a: 1, b: 2 } }), { data_values: [1, 2] });
  });

  test('length transform', () => {
    const fn = compileSelector('items|length');
    assert.deepStrictEqual(fn({ items: [1, 2, 3] }), { items_length: 3 });
  });

  test('first transform', () => {
    const fn = compileSelector('items|first');
    assert.deepStrictEqual(fn({ items: ['a', 'b', 'c'] }), { items_first: 'a' });
  });

  test('last transform', () => {
    const fn = compileSelector('items|last');
    assert.deepStrictEqual(fn({ items: ['a', 'b', 'c'] }), { items_last: 'c' });
  });

  test('sort transform', () => {
    const fn = compileSelector('items|sort');
    assert.deepStrictEqual(fn({ items: ['c', 'a', 'b'] }), { items_sort: ['a', 'b', 'c'] });
  });

  test('unique transform', () => {
    const fn = compileSelector('items|unique');
    assert.deepStrictEqual(fn({ items: [1, 2, 2, 3, 3, 3] }), { items_unique: [1, 2, 3] });
  });

  test('compact transform', () => {
    const fn = compileSelector('items|compact');
    assert.deepStrictEqual(fn({ items: [1, null, 2, undefined, 3] }), { items_compact: [1, 2, 3] });
  });

  test('flatten transform', () => {
    const fn = compileSelector('items|flatten');
    assert.deepStrictEqual(fn({ items: [[1, 2], [3, 4]] }), { items_flatten: [1, 2, 3, 4] });
  });

  test('sum transform', () => {
    const fn = compileSelector('items|sum');
    assert.deepStrictEqual(fn({ items: [1, 2, 3, 4] }), { items_sum: 10 });
  });
});

describe('compileFilter', () => {
  test('returns always-true for null/undefined', () => {
    const fn = compileFilter(null);
    assert.strictEqual(fn({ any: 'value' }), true);
  });

  test('filters with equality', () => {
    const fn = compileFilter('name == lodash');
    assert.strictEqual(fn({ name: 'lodash' }), true);
    assert.strictEqual(fn({ name: 'express' }), false);
  });

  test('filters with inequality', () => {
    const fn = compileFilter('name != lodash');
    assert.strictEqual(fn({ name: 'lodash' }), false);
    assert.strictEqual(fn({ name: 'express' }), true);
  });

  test('filters with greater than', () => {
    const fn = compileFilter('count > 10');
    assert.strictEqual(fn({ count: 15 }), true);
    assert.strictEqual(fn({ count: 5 }), false);
  });

  test('filters with less than', () => {
    const fn = compileFilter('count < 10');
    assert.strictEqual(fn({ count: 5 }), true);
    assert.strictEqual(fn({ count: 15 }), false);
  });

  test('filters with transforms', () => {
    const fn = compileFilter('versions|keys|length > 5');
    assert.strictEqual(fn({ versions: { '1': {}, '2': {}, '3': {}, '4': {}, '5': {}, '6': {} } }), true);
    assert.strictEqual(fn({ versions: { '1': {}, '2': {} } }), false);
  });

  test('filters with null comparison', () => {
    const fn = compileFilter('value == null');
    assert.strictEqual(fn({ value: null }), true);
    assert.strictEqual(fn({ value: 'something' }), false);
  });

  test('filters with boolean comparison', () => {
    const fn = compileFilter('active == true');
    assert.strictEqual(fn({ active: true }), true);
    assert.strictEqual(fn({ active: false }), false);
  });

  test('existence filter', () => {
    const fn = compileFilter('name');
    assert.strictEqual(fn({ name: 'lodash' }), true);
    assert.strictEqual(fn({ name: '' }), false);
    assert.strictEqual(fn({ name: null }), false);
  });
});

describe('createProjection', () => {
  test('returns identity when no select', () => {
    const fn = createProjection({});
    const obj = { a: 1, b: 2 };
    assert.deepStrictEqual(fn(obj), obj);
  });

  test('uses select option', () => {
    const fn = createProjection({ select: 'name' });
    assert.deepStrictEqual(fn({ name: 'test', extra: 'ignored' }), { name: 'test' });
  });
});

describe('createFilter', () => {
  test('returns always-true when no where', () => {
    const fn = createFilter({});
    assert.strictEqual(fn({ any: 'value' }), true);
  });

  test('uses where option', () => {
    const fn = createFilter({ where: 'count > 0' });
    assert.strictEqual(fn({ count: 5 }), true);
    assert.strictEqual(fn({ count: 0 }), false);
  });
});

describe('bracket notation', () => {
  test('selects with bracket notation double quotes', () => {
    const fn = compileSelector('time["4.17.21"]');
    const result = fn({
      time: { '4.17.21': '2021-02-20T15:42:16.891Z' }
    });

    assert.deepStrictEqual(result, { '4.17.21': '2021-02-20T15:42:16.891Z' });
  });

  test('selects with bracket notation single quotes', () => {
    const fn = compileSelector("time['4.17.21']");
    const result = fn({
      time: { '4.17.21': '2021-02-20T15:42:16.891Z' }
    });

    assert.deepStrictEqual(result, { '4.17.21': '2021-02-20T15:42:16.891Z' });
  });

  test('selects with mixed notation', () => {
    const fn = compileSelector('versions["1.0.0"].dist.integrity');
    const result = fn({
      versions: {
        '1.0.0': { dist: { integrity: 'sha512-abc123' } }
      }
    });

    assert.deepStrictEqual(result, { integrity: 'sha512-abc123' });
  });

  test('selects with bracket notation and transform', () => {
    const fn = compileSelector('time["4.17.21"] as publishedAt');
    const result = fn({
      time: { '4.17.21': '2021-02-20T15:42:16.891Z' }
    });

    assert.deepStrictEqual(result, { publishedAt: '2021-02-20T15:42:16.891Z' });
  });

  test('handles missing bracket key gracefully', () => {
    const fn = compileSelector('time["missing"]');
    const result = fn({
      time: { '4.17.21': '2021-02-20T15:42:16.891Z' }
    });

    assert.deepStrictEqual(result, { missing: undefined });
  });

  test('selects with numeric bracket notation', () => {
    const fn = compileSelector('items[0]');
    const result = fn({
      items: ['first', 'second', 'third']
    });

    assert.deepStrictEqual(result, { '0': 'first' });
  });
});
