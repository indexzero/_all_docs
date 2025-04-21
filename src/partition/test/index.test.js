const { describe, it } = require('node:test');
const { readFile, unlink } = require('node:fs/promises');
const { join } = require('node:path');
const { ok } = require('node:assert/strict');

const { 
  getPartition,
  writePartition 
} = require('../src/index');

const fixtures = join(__dirname, 'fixtures');

describe('_all_docs/request', () => {
  it('getPartition(opts) returns a valid _all_docs partition', async () => {
    const partition = {
      startKey: '8',
      endKey: '9',
      filename: join(fixtures, '8___9.json')
    };

    const doc = await getPartition({ partition });

    ok(doc.total_rows > 0);
    ok(doc.offset > 0);
    ok(doc.rows.length > 0);
  });

  it('writePartition(opts) should write a file', async () => {
    const partition = {
      startKey: '8',
      endKey: '9',
      filename: join(fixtures, '8___9.json')
    };

    await writePartition({ partition });
    const text = await readFile(partition.filename, 'utf8');
    const doc = JSON.parse(text);

    ok(doc.total_rows > 0);
    ok(doc.offset > 0);
    ok(doc.rows.length > 0);

    await unlink(partition.filename);
  });
});
