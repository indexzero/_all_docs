import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { LocalDirStorageDriver, isLocalPath } from '../local-dir-driver.js';

describe('LocalDirStorageDriver', () => {
  let tempDir;
  let driver;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'local-dir-driver-test-'));
    driver = new LocalDirStorageDriver(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('list()', () => {
    it('should list JSON files in directory', async () => {
      await writeFile(join(tempDir, 'lodash.json'), JSON.stringify({ name: 'lodash' }));
      await writeFile(join(tempDir, 'react.json'), JSON.stringify({ name: 'react' }));
      await writeFile(join(tempDir, 'readme.md'), 'not json');

      const files = [];
      for await (const file of driver.list()) {
        files.push(file);
      }

      assert.strictEqual(files.length, 2);
      assert.ok(files.includes('lodash.json'));
      assert.ok(files.includes('react.json'));
      assert.ok(!files.includes('readme.md'));
    });

    it('should ignore prefix parameter', async () => {
      await writeFile(join(tempDir, 'lodash.json'), JSON.stringify({ name: 'lodash' }));

      const files = [];
      for await (const file of driver.list('v1:packument:npm:')) {
        files.push(file);
      }

      assert.strictEqual(files.length, 1);
      assert.strictEqual(files[0], 'lodash.json');
    });

    it('should handle empty directory', async () => {
      const files = [];
      for await (const file of driver.list()) {
        files.push(file);
      }

      assert.strictEqual(files.length, 0);
    });
  });

  describe('get()', () => {
    it('should read and parse JSON file', async () => {
      const packument = { name: 'lodash', version: '4.17.21' };
      await writeFile(join(tempDir, 'lodash.json'), JSON.stringify(packument));

      const result = await driver.get('lodash.json');
      assert.deepStrictEqual(result, packument);
    });

    it('should add .json extension if missing', async () => {
      const packument = { name: 'lodash', version: '4.17.21' };
      await writeFile(join(tempDir, 'lodash.json'), JSON.stringify(packument));

      const result = await driver.get('lodash');
      assert.deepStrictEqual(result, packument);
    });

    it('should throw on missing file', async () => {
      await assert.rejects(
        driver.get('nonexistent.json'),
        /Key not found: nonexistent\.json/
      );
    });

    it('should throw on invalid JSON', async () => {
      await writeFile(join(tempDir, 'invalid.json'), 'not valid json');

      await assert.rejects(
        driver.get('invalid.json'),
        /Unexpected token/
      );
    });
  });

  describe('has()', () => {
    it('should return true for existing file', async () => {
      await writeFile(join(tempDir, 'lodash.json'), JSON.stringify({ name: 'lodash' }));

      const exists = await driver.has('lodash.json');
      assert.strictEqual(exists, true);
    });

    it('should return true with implicit .json extension', async () => {
      await writeFile(join(tempDir, 'lodash.json'), JSON.stringify({ name: 'lodash' }));

      const exists = await driver.has('lodash');
      assert.strictEqual(exists, true);
    });

    it('should return false for missing file', async () => {
      const exists = await driver.has('nonexistent.json');
      assert.strictEqual(exists, false);
    });
  });

  describe('read-only methods', () => {
    it('should throw on put()', async () => {
      await assert.rejects(
        driver.put('key', { value: 'data' }),
        /LocalDirStorageDriver is read-only/
      );
    });

    it('should throw on delete()', async () => {
      await assert.rejects(
        driver.delete('key'),
        /LocalDirStorageDriver is read-only/
      );
    });

    it('should throw on clear()', async () => {
      await assert.rejects(
        driver.clear(),
        /LocalDirStorageDriver is read-only/
      );
    });

    it('should throw on putBatch()', async () => {
      await assert.rejects(
        driver.putBatch([{ key: 'k', value: 'v' }]),
        /LocalDirStorageDriver is read-only/
      );
    });
  });

  describe('info()', () => {
    it('should return info for existing file', async () => {
      await writeFile(join(tempDir, 'lodash.json'), JSON.stringify({ name: 'lodash' }));

      const info = await driver.info('lodash.json');
      assert.ok(info);
      assert.strictEqual(info.key, 'lodash.json');
      assert.ok(info.path.includes('lodash.json'));
    });

    it('should return null for missing file', async () => {
      const info = await driver.info('nonexistent.json');
      assert.strictEqual(info, null);
    });
  });

  describe('file:// URL support', () => {
    it('should handle file:// URL paths', async () => {
      const fileUrlPath = `file://${tempDir}`;
      const urlDriver = new LocalDirStorageDriver(fileUrlPath);

      await writeFile(join(tempDir, 'test.json'), JSON.stringify({ name: 'test' }));

      const files = [];
      for await (const file of urlDriver.list()) {
        files.push(file);
      }

      assert.strictEqual(files.length, 1);
      assert.strictEqual(files[0], 'test.json');
    });
  });
});

describe('isLocalPath', () => {
  it('should detect file:// URLs', () => {
    assert.strictEqual(isLocalPath('file:///path/to/dir'), true);
  });

  it('should detect absolute Unix paths', () => {
    assert.strictEqual(isLocalPath('/path/to/dir'), true);
  });

  it('should detect relative paths with ./', () => {
    assert.strictEqual(isLocalPath('./path/to/dir'), true);
  });

  it('should detect relative paths with ../', () => {
    assert.strictEqual(isLocalPath('../path/to/dir'), true);
  });

  it('should detect Windows absolute paths', () => {
    assert.strictEqual(isLocalPath('C:\\path\\to\\dir'), true);
    assert.strictEqual(isLocalPath('D:/path/to/dir'), true);
  });

  it('should reject registry URLs', () => {
    assert.strictEqual(isLocalPath('https://registry.npmjs.org'), false);
    assert.strictEqual(isLocalPath('http://localhost:4873'), false);
  });

  it('should reject encoded origins', () => {
    assert.strictEqual(isLocalPath('npm'), false);
    assert.strictEqual(isLocalPath('registry.npmjs.org'), false);
  });

  it('should handle null/undefined', () => {
    assert.strictEqual(isLocalPath(null), false);
    assert.strictEqual(isLocalPath(undefined), false);
    assert.strictEqual(isLocalPath(''), false);
  });
});
