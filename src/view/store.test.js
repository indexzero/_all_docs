import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ViewStore } from './store.js';
import { View } from './view.js';

describe('ViewStore', () => {
  let tempDir;
  let store;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'view-store-test-'));
    store = new ViewStore(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test('saves and loads a view', async () => {
    const view = new View({
      name: 'test-view',
      origin: 'npm',
      select: 'name, versions|keys'
    });

    await store.save(view);
    const loaded = await store.load('test-view');

    assert.strictEqual(loaded.name, 'test-view');
    assert.strictEqual(loaded.origin, 'npm');
    assert.strictEqual(loaded.select, 'name, versions|keys');
  });

  test('lists views', async () => {
    const view1 = new View({ name: 'view-a', origin: 'npm' });
    const view2 = new View({ name: 'view-b', origin: 'private' });

    await store.save(view1);
    await store.save(view2);

    const names = await store.list();
    assert.deepStrictEqual(names.sort(), ['view-a', 'view-b']);
  });

  test('returns empty list when no views', async () => {
    const names = await store.list();
    assert.deepStrictEqual(names, []);
  });

  test('checks if view exists', async () => {
    const view = new View({ name: 'existing', origin: 'npm' });
    await store.save(view);

    assert.strictEqual(await store.exists('existing'), true);
    assert.strictEqual(await store.exists('non-existing'), false);
  });

  test('deletes a view', async () => {
    const view = new View({ name: 'to-delete', origin: 'npm' });
    await store.save(view);

    assert.strictEqual(await store.exists('to-delete'), true);

    await store.delete('to-delete');

    assert.strictEqual(await store.exists('to-delete'), false);
  });

  test('throws when loading non-existent view', async () => {
    await assert.rejects(
      () => store.load('non-existent'),
      /View 'non-existent' not found/
    );
  });

  test('throws when deleting non-existent view', async () => {
    await assert.rejects(
      () => store.delete('non-existent'),
      /View 'non-existent' not found/
    );
  });

  test('sanitizes view names for storage', async () => {
    const view = new View({ name: 'test_view-123', origin: 'npm' });
    await store.save(view);

    // Should be able to load it back
    const loaded = await store.load('test_view-123');
    assert.strictEqual(loaded.name, 'test_view-123');
  });

  test('overwrites existing view', async () => {
    const view1 = new View({ name: 'overwrite-test', origin: 'npm' });
    await store.save(view1);

    const view2 = new View({ name: 'overwrite-test', origin: 'private' });
    await store.save(view2);

    const loaded = await store.load('overwrite-test');
    assert.strictEqual(loaded.origin, 'private');
  });
});
