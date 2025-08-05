import { describe, it } from 'node:test';
import { join } from 'node:path';
import { ok } from 'node:assert/strict';
import { rimraf } from 'rimraf';
import { PartitionClient } from '../client.js';

const fixtures = join(import.meta.dirname, 'fixtures');

describe('_all_docs/client', () => {
  it('.request({ 8, 9 }) returns a valid cache entry', async () => {
    const client = new PartitionClient({
      origin: 'https://replicate.npmjs.com',
      cache: fixtures
    });

    const entry = await client.request({
      startKey: '8',
      endKey: '9'
    });

    const doc = entry.body;

    // TODO (0): validate all this stuff too
    // console.dir(entry.toJSON());

    ok(doc.total_rows > 0);
    ok(doc.offset > 0);
    ok(doc.rows.length > 0);
  });

  it('.request({ 7, 8 }) returns a cache entry', async () => {
    const client = new PartitionClient({
      origin: 'https://replicate.npmjs.com',
      cache: fixtures
    });

    const entry = await client.request({
      startKey: '7',
      endKey: '8'
    });

    const doc = entry.body;

    ok(doc.total_rows > 0);
    ok(doc.offset > 0);
    ok(doc.rows.length > 0);
  });

  it('.requestAll([...rest]) returns cache entries', async () => {
    const client = new PartitionClient({
      origin: 'https://replicate.npmjs.com',
      cache: fixtures
    });

    const entries = await client.requestAll([
      { startKey: '3', endKey: '4' },
      { startKey: '4', endKey: '5' }
    ]);

    for (const entry of entries) {
      const doc = entry.body;

      ok(doc.total_rows > 0);
      ok(doc.offset > 0);
      ok(doc.rows.length > 0);
    }
  });

  it('(cleanup) delete the local partition cache', async () => {
    await rimraf(join(fixtures, 'partitions'), {
      maxRetries: 1,
      retryDelay: 1
    });
  });
});
