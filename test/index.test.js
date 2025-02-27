const { describe, it } = require('node:test');
const { readFile, unlink } = require('node:fs/promises');
const { join } = require('node:path');
const { ok } = require('node:assert/strict');

const { allDocsForPartition } = require('../src/index');

const fixtures = join(__dirname, 'fixtures');

describe('_all_docs for a partition', () => {
  it('should write a file', async () => {
    const partition = {
      startKey: '8',
      endKey: '9',
      filename: join(fixtures, '8___9.json')
    };

    await allDocsForPartition(partition);
    const text = await readFile(partition.filename, 'utf8');
    const doc = JSON.parse(text);

    ok(doc.total_rows > 0);
    ok(doc.offset > 0);
    ok(doc.rows.length > 0);

    await unlink(partition.filename);
  });
});
