import { test, describe } from 'node:test';
import assert from 'node:assert';
import { View } from './view.js';

describe('View', () => {
  test('creates a view with required properties', () => {
    const view = new View({
      name: 'test-view',
      origin: 'npm'
    });

    assert.strictEqual(view.name, 'test-view');
    assert.strictEqual(view.origin, 'npm');
    assert.strictEqual(view.type, 'packument');
    assert.strictEqual(view.select, null);
    assert.ok(view.createdAt);
  });

  test('creates a view with all properties', () => {
    const view = new View({
      name: 'full-view',
      origin: 'npm',
      type: 'partition',
      select: 'name, versions|keys'
    });

    assert.strictEqual(view.name, 'full-view');
    assert.strictEqual(view.origin, 'npm');
    assert.strictEqual(view.type, 'partition');
    assert.strictEqual(view.select, 'name, versions|keys');
  });

  test('encodes registry URL to origin', () => {
    const view = new View({
      name: 'registry-view',
      registry: 'https://npm.example.com'
    });

    // Origin is truncated: example -> exa + le = exale
    assert.strictEqual(view.origin, 'npm.exale.com');
    assert.strictEqual(view.registry, 'https://npm.example.com');
  });

  test('throws when name is missing', () => {
    assert.throws(() => {
      new View({ origin: 'npm' });
    }, /View name is required/);
  });

  test('throws when origin and registry are missing', () => {
    assert.throws(() => {
      new View({ name: 'test' });
    }, /Origin or registry is required/);
  });

  test('generates cache key prefix', () => {
    const view = new View({
      name: 'test',
      origin: 'npm',
      type: 'packument'
    });

    assert.strictEqual(view.getCacheKeyPrefix(), 'v1:packument:npm:');
  });

  test('serializes to JSON', () => {
    const view = new View({
      name: 'test',
      origin: 'npm',
      select: 'name'
    });

    const json = view.toJSON();
    assert.strictEqual(json.name, 'test');
    assert.strictEqual(json.origin, 'npm');
    assert.strictEqual(json.select, 'name');
    assert.ok(json.createdAt);
  });

  test('deserializes from JSON', () => {
    const json = {
      name: 'test',
      origin: 'npm',
      type: 'packument',
      select: 'name, versions|keys',
      createdAt: '2024-01-15T10:00:00.000Z'
    };

    const view = View.fromJSON(json);
    assert.strictEqual(view.name, 'test');
    assert.strictEqual(view.origin, 'npm');
    assert.strictEqual(view.select, 'name, versions|keys');
    assert.strictEqual(view.createdAt, json.createdAt);
  });

  test('toString returns readable representation', () => {
    const view = new View({
      name: 'npm-packages',
      origin: 'npm'
    });

    assert.strictEqual(view.toString(), 'View(npm-packages: npm/packument)');
  });
});
