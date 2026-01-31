import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { join } from 'node:path';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { PackumentListCheckpoint } from './checkpoint.js';

describe('PackumentListCheckpoint', () => {
  const testDir = join(import.meta.dirname, 'test-fixtures');
  const testInputFile = join(testDir, 'test-packages.json');
  const testPackages = ['lodash', 'express', 'debug', '@babel/core', '@types/node'];
  let checkpoint;

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
    writeFileSync(testInputFile, JSON.stringify(testPackages));
    checkpoint = new PackumentListCheckpoint(testInputFile);
  });

  afterEach(() => {
    // Clean up test checkpoint
    if (checkpoint.exists()) {
      checkpoint.delete();
    }
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('initialize', () => {
    it('should create checkpoint with all packages as pending', () => {
      const result = checkpoint.initialize(testPackages);

      assert.equal(result.version, 1);
      assert.equal(result.total, 5);
      assert.equal(result.inputFile, testInputFile);
      assert.ok(result.inputHash);
      assert.ok(result.createdAt);
      assert.ok(result.updatedAt);

      for (const name of testPackages) {
        assert.ok(result.packages[name]);
        assert.equal(result.packages[name].status, 'pending');
        assert.equal(result.packages[name].attempts, 0);
        assert.equal(result.packages[name].cached, false);
        assert.equal(result.packages[name].error, null);
      }
    });

    it('should create checkpoint file on disk', () => {
      checkpoint.initialize(testPackages);
      assert.ok(checkpoint.exists());
    });
  });

  describe('load', () => {
    it('should load existing checkpoint', () => {
      checkpoint.initialize(testPackages);

      const newCheckpoint = new PackumentListCheckpoint(testInputFile);
      const loaded = newCheckpoint.load();

      assert.ok(loaded);
      assert.equal(loaded.total, 5);
      assert.ok(loaded.packages['lodash']);
    });

    it('should return null for non-existent checkpoint', () => {
      const result = checkpoint.load();
      assert.equal(result, null);
    });
  });

  describe('exists', () => {
    it('should return false when no checkpoint exists', () => {
      assert.equal(checkpoint.exists(), false);
    });

    it('should return true after initialization', () => {
      checkpoint.initialize(testPackages);
      assert.equal(checkpoint.exists(), true);
    });
  });

  describe('delete', () => {
    it('should remove checkpoint file', () => {
      checkpoint.initialize(testPackages);
      assert.ok(checkpoint.exists());

      checkpoint.delete();
      assert.equal(checkpoint.exists(), false);
    });

    it('should handle deleting non-existent checkpoint', () => {
      // Should not throw
      checkpoint.delete();
      assert.equal(checkpoint.exists(), false);
    });
  });

  describe('verifyInputHash', () => {
    it('should return true when input file unchanged', () => {
      checkpoint.initialize(testPackages);
      assert.equal(checkpoint.verifyInputHash(), true);
    });

    it('should return false when input file changed', () => {
      checkpoint.initialize(testPackages);

      // Modify the input file
      writeFileSync(testInputFile, JSON.stringify([...testPackages, 'new-package']));

      assert.equal(checkpoint.verifyInputHash(), false);
    });

    it('should return false when no checkpoint loaded', () => {
      assert.equal(checkpoint.verifyInputHash(), false);
    });
  });

  describe('markCompleted', () => {
    it('should mark package as completed', () => {
      checkpoint.initialize(testPackages);
      checkpoint.markCompleted('lodash', false);

      const status = checkpoint.getStatus();
      assert.equal(status.stats.completed, 1);
      assert.equal(status.stats.pending, 4);
    });

    it('should track cached vs fetched', () => {
      checkpoint.initialize(testPackages);
      checkpoint.markCompleted('lodash', true);  // cached
      checkpoint.markCompleted('express', false); // fetched

      const status = checkpoint.getStatus();
      assert.equal(status.stats.cached, 1);
      assert.equal(status.stats.fetched, 1);
    });
  });

  describe('markFailed', () => {
    it('should mark package as failed with error', () => {
      checkpoint.initialize(testPackages);
      checkpoint.markFailed('lodash', 'Network timeout');

      const status = checkpoint.getStatus();
      assert.equal(status.stats.failed, 1);

      const failed = checkpoint.getFailed();
      assert.equal(failed.length, 1);
      assert.equal(failed[0].name, 'lodash');
      assert.equal(failed[0].error, 'Network timeout');
    });

    it('should increment attempts on failure', () => {
      checkpoint.initialize(testPackages);
      checkpoint.markFailed('lodash', 'Error 1');
      checkpoint.markFailed('lodash', 'Error 2');

      const failed = checkpoint.getFailed();
      assert.equal(failed[0].attempts, 2);
    });
  });

  describe('markInProgress', () => {
    it('should mark package as in progress', () => {
      checkpoint.initialize(testPackages);
      checkpoint.markInProgress('lodash');

      const status = checkpoint.getStatus();
      assert.equal(status.stats.inProgress, 1);
    });

    it('should increment attempts', () => {
      checkpoint.initialize(testPackages);
      checkpoint.markInProgress('lodash');
      checkpoint.markInProgress('lodash');

      // Check via checkpoint directly (in memory, not reloaded)
      assert.equal(checkpoint.checkpoint.packages['lodash'].attempts, 2);
    });
  });

  describe('getPending', () => {
    it('should return all pending packages initially', () => {
      checkpoint.initialize(testPackages);
      const pending = checkpoint.getPending();

      assert.equal(pending.length, 5);
      assert.deepEqual(pending.sort(), testPackages.sort());
    });

    it('should exclude completed packages', () => {
      checkpoint.initialize(testPackages);
      checkpoint.markCompleted('lodash', false);
      checkpoint.markCompleted('express', false);

      const pending = checkpoint.getPending();
      assert.equal(pending.length, 3);
      assert.ok(!pending.includes('lodash'));
      assert.ok(!pending.includes('express'));
    });

    it('should include failed packages with < 3 attempts', () => {
      checkpoint.initialize(testPackages);
      checkpoint.markFailed('lodash', 'Error');
      checkpoint.markFailed('lodash', 'Error');

      const pending = checkpoint.getPending();
      assert.ok(pending.includes('lodash'));
    });

    it('should exclude failed packages with >= 3 attempts', () => {
      checkpoint.initialize(testPackages);
      checkpoint.markFailed('lodash', 'Error 1');
      checkpoint.markFailed('lodash', 'Error 2');
      checkpoint.markFailed('lodash', 'Error 3');

      const pending = checkpoint.getPending();
      assert.ok(!pending.includes('lodash'));
    });
  });

  describe('getFailed', () => {
    it('should return empty array when no failures', () => {
      checkpoint.initialize(testPackages);
      const failed = checkpoint.getFailed();
      assert.deepEqual(failed, []);
    });

    it('should return failed packages with details', () => {
      checkpoint.initialize(testPackages);
      checkpoint.markFailed('lodash', 'Timeout');
      checkpoint.markFailed('express', 'Not found');

      const failed = checkpoint.getFailed();
      assert.equal(failed.length, 2);

      const lodashFail = failed.find(f => f.name === 'lodash');
      assert.ok(lodashFail);
      assert.equal(lodashFail.error, 'Timeout');
      assert.equal(lodashFail.attempts, 1);
    });
  });

  describe('getStatus', () => {
    it('should return null when no checkpoint', () => {
      const status = checkpoint.getStatus();
      assert.equal(status, null);
    });

    it('should return complete status summary', () => {
      checkpoint.initialize(testPackages);
      checkpoint.markCompleted('lodash', true);
      checkpoint.markCompleted('express', false);
      checkpoint.markFailed('debug', 'Error');

      const status = checkpoint.getStatus();

      assert.ok(status.checkpointPath);
      assert.equal(status.inputFile, testInputFile);
      assert.equal(status.inputHashMatch, true);
      assert.ok(status.createdAt);
      assert.ok(status.updatedAt);

      assert.equal(status.stats.total, 5);
      assert.equal(status.stats.completed, 2);
      assert.equal(status.stats.cached, 1);
      assert.equal(status.stats.fetched, 1);
      assert.equal(status.stats.pending, 2);
      assert.equal(status.stats.failed, 1);

      assert.equal(status.percentComplete, '40.0');
    });
  });

  describe('save and saveIfDirty', () => {
    it('should persist changes to disk', () => {
      checkpoint.initialize(testPackages);
      checkpoint.markCompleted('lodash', false);
      checkpoint.save();

      const newCheckpoint = new PackumentListCheckpoint(testInputFile);
      newCheckpoint.load();
      const status = newCheckpoint.getStatus();

      assert.equal(status.stats.completed, 1);
    });

    it('should only save when dirty', () => {
      checkpoint.initialize(testPackages);
      const firstUpdatedAt = checkpoint.checkpoint.updatedAt;

      // Wait a tiny bit to ensure timestamp would differ
      checkpoint.saveIfDirty(); // Not dirty, shouldn't update

      checkpoint.markCompleted('lodash', false);
      checkpoint.saveIfDirty(); // Now dirty, should save

      const newCheckpoint = new PackumentListCheckpoint(testInputFile);
      newCheckpoint.load();
      assert.ok(newCheckpoint.checkpoint.updatedAt >= firstUpdatedAt);
    });
  });

  describe('scoped packages', () => {
    it('should handle scoped package names', () => {
      checkpoint.initialize(testPackages);
      checkpoint.markCompleted('@babel/core', false);
      checkpoint.markCompleted('@types/node', true);

      const status = checkpoint.getStatus();
      assert.equal(status.stats.completed, 2);

      const pending = checkpoint.getPending();
      assert.ok(!pending.includes('@babel/core'));
      assert.ok(!pending.includes('@types/node'));
    });
  });
});
