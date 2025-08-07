import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { join } from 'node:path';
import { rimraf } from 'rimraf';

// Import all the components
import { PartitionClient } from '@_all_docs/partition';
import { PackumentClient } from '@_all_docs/packument';
import { Cache, PartitionCheckpoint } from '@_all_docs/cache';
import { LocalWorkQueue } from '@_all_docs/worker-node/queue';
import { processPartition, processPackument, processPartitionSet } from '@_all_docs/worker/processors';
import { WorkItemTypes } from '@_all_docs/types';

describe('End-to-End Integration Tests', () => {
  const fixturesPath = join(import.meta.dirname, 'fixtures');
  let env;

  beforeEach(() => {
    env = {
      NPM_ORIGIN: 'https://replicate.npmjs.com',
      RUNTIME: 'node',
      CACHE_DIR: fixturesPath,
      DEBUG: true
    };
  });

  afterEach(async () => {
    await rimraf(fixturesPath, { glob: false, maxRetries: 1 });
  });

  describe.skip('Partition Processing Pipeline', () => {
    it('should fetch and cache partition data', async () => {
      const client = new PartitionClient({ 
        env,
        origin: 'https://replicate.npmjs.com'
      });
      
      // Request a small partition
      const entry = await client.request({
        startKey: 'zz',
        endKey: 'zzz'
      });

      assert.ok(entry);
      assert.equal(entry.statusCode, 200);
      assert.ok(entry.body);
      assert.ok(entry.body.rows);
      assert.ok(Array.isArray(entry.body.rows));
      assert.equal(entry.hit, false); // First request is a miss

      // Second request should hit cache
      const cachedEntry = await client.request({
        startKey: 'zz',
        endKey: 'zzz'
      });

      assert.equal(cachedEntry.hit, true);
      assert.deepEqual(cachedEntry.body, entry.body);
    });

    it('should process partition work items', async () => {
      const workItem = {
        type: WorkItemTypes.PARTITION,
        id: 'test-partition-1',
        payload: {
          startKey: 'zy',
          endKey: 'zz'
        },
        priority: 1,
        attempts: 0
      };

      const partitionEnv = {
        ...env,
        NPM_ORIGIN: 'https://replicate.npmjs.com'
      };
      const result = await processPartition(workItem, partitionEnv);

      assert.equal(result.success, true);
      assert.ok(result.metrics);
      assert.ok(result.metrics.totalRows > 0);
      assert.ok(result.metrics.fetchedRows > 0);
    });
  });

  describe.skip('Packument Processing Pipeline', () => {
    it('should fetch and cache packument data', async () => {
      const client = new PackumentClient({ env });
      
      // Request a small package
      const entry = await client.request('lodash', {
        cache: true
      });

      assert.ok(entry);
      assert.equal(entry.statusCode, 200);
      assert.ok(entry.body);
      assert.ok(entry.body.name === 'lodash');
      assert.ok(entry.body.versions);
      assert.equal(entry.hit, false);

      // Second request should hit cache
      const cachedEntry = await client.request('lodash');
      assert.equal(cachedEntry.hit, true);
    });

    it('should process packument work items with dependencies', async () => {
      const workItem = {
        type: WorkItemTypes.PACKUMENT,
        id: 'test-packument-1',
        payload: {
          packageName: 'express',
          fetchDependencies: true
        },
        priority: 1,
        attempts: 0
      };

      const result = await processPackument(workItem, env);

      assert.equal(result.success, true);
      assert.ok(result.metrics);
      assert.ok(result.metrics.versions > 0);
      assert.ok(result.metrics.dependencies.length > 0);
      assert.ok(result.metrics.hasReadme);
    });
  });

  describe.skip('Partition Set Processing with Checkpoints', () => {
    it('should process partition set and track progress', async () => {
      const partitions = [
        { startKey: 'aaa', endKey: 'aab' },
        { startKey: 'aab', endKey: 'aac' },
        { startKey: 'aac', endKey: 'aad' }
      ];

      const enqueuedItems = [];
      const mockEnqueue = async (item) => {
        enqueuedItems.push(item);
      };

      const workItem = {
        type: WorkItemTypes.PARTITION_SET,
        id: 'test-set-1',
        payload: {
          partitions,
          partitionSetId: 'checkpoint-test-1'
        },
        priority: 1,
        attempts: 0
      };

      // Process the partition set
      const result = await processPartitionSet(workItem, env, mockEnqueue);

      assert.equal(result.success, true);
      assert.equal(result.data.partitionCount, 3);
      assert.equal(enqueuedItems.length, 3);

      // Verify checkpoint was created
      const cache = new Cache({ path: join(fixturesPath, 'partitions'), env });
      const checkpoint = new PartitionCheckpoint(cache, 'checkpoint-test-1');
      const progress = await checkpoint.getProgress();

      assert.ok(progress);
      assert.equal(progress.stats.total, 3);
      assert.equal(progress.stats.pending, 3);

      // Process first partition
      const firstPartition = enqueuedItems[0];
      const partitionEnv = {
        ...env,
        NPM_ORIGIN: 'https://replicate.npmjs.com'
      };
      await processPartition(firstPartition, partitionEnv);

      // Check progress again
      const updatedProgress = await checkpoint.getProgress();
      assert.equal(updatedProgress.stats.completed, 1);
      assert.equal(updatedProgress.stats.pending, 2);
      assert.equal(updatedProgress.percentComplete, 33.33333333333333);
    });
  });

  describe.skip('Queue Integration', () => {
    it('should process work items through local queue', async () => {
      const queue = new LocalWorkQueue({
        concurrency: 2,
        requestsPerSecond: 5
      });

      // Create a mock worker that uses real processors
      const mockWorker = {
        async process(workItem) {
          switch (workItem.type) {
            case WorkItemTypes.PARTITION:
              const partitionEnv = {
                ...env,
                NPM_ORIGIN: 'https://replicate.npmjs.com'
              };
              return await processPartition(workItem, partitionEnv);
            case WorkItemTypes.PACKUMENT:
              return await processPackument(workItem, env);
            default:
              throw new Error(`Unknown work item type: ${workItem.type}`);
          }
        }
      };

      queue.workers.set('main', mockWorker);

      // Add multiple work items
      const workItems = [
        {
          type: WorkItemTypes.PACKUMENT,
          id: 'queue-pkg-1',
          payload: { packageName: 'minimist' },
          priority: 2
        },
        {
          type: WorkItemTypes.PARTITION,
          id: 'queue-part-1',
          payload: { startKey: 'zzz', endKey: 'zzzz' },
          priority: 1
        }
      ];

      const results = await Promise.all(
        workItems.map(item => queue.addWork(item))
      );

      assert.equal(results.length, 2);
      results.forEach(result => {
        assert.equal(result.success, true);
        assert.ok(result.metrics);
      });
    });
  });

  describe('Cache Key Compatibility', () => {
    it('should use consistent cache keys across components', async () => {
      const partitionClient = new PartitionClient({ env });
      const packumentClient = new PackumentClient({ env });

      // Make requests to populate cache
      await partitionClient.request({ startKey: 'x', endKey: 'y' });
      await packumentClient.request('react');

      // Verify cache keys are properly formatted
      const cache = new Cache({ path: join(fixturesPath, 'partitions'), env });
      let foundPartitionKey = false;
      
      for await (const key of cache.keys('v1:partition:')) {
        foundPartitionKey = true;
        assert.ok(key.startsWith('v1:partition:npm:'));
      }
      assert.ok(foundPartitionKey);

      const packumentCache = new Cache({ path: join(fixturesPath, 'packuments'), env });
      let foundPackumentKey = false;
      
      for await (const key of packumentCache.keys('v1:packument:')) {
        foundPackumentKey = true;
        assert.ok(key.startsWith('v1:packument:npm:'));
      }
      assert.ok(foundPackumentKey);
    });
  });

  describe.skip('Error Handling and Recovery', () => {
    it('should handle and recover from network errors', async () => {
      const badEnv = {
        ...env,
        NPM_ORIGIN: 'https://definitely-not-a-real-registry.example.com'
      };

      const client = new PartitionClient({ env: badEnv });
      
      await assert.rejects(
        async () => await client.request({ startKey: 'a', endKey: 'b' }),
        /fetch failed|ENOTFOUND|network/i
      );
    });

    it('should handle malformed responses gracefully', async () => {
      // This test would require mocking the HTTP response
      // For now, we'll test with an invalid package name that returns 404
      const client = new PackumentClient({ env });
      
      const entry = await client.request('../../../etc/passwd');
      assert.equal(entry, null); // Should return null for 404
    });
  });

  describe.skip('Performance Considerations', () => {
    it('should coalesce concurrent cache requests', async () => {
      const cache = new Cache({ path: join(fixturesPath, 'perf-test'), env });
      
      // Set a value
      await cache.set('perf-key', { value: 'test-data' });
      
      // Make concurrent requests
      const requests = Array(10).fill(null).map(() => 
        cache.fetch('perf-key')
      );
      
      const results = await Promise.all(requests);
      
      // All should get the same result
      results.forEach(result => {
        assert.deepEqual(result, { value: 'test-data' });
      });
    });

    it('should respect rate limits in queue processing', async () => {
      const queue = new LocalWorkQueue({
        concurrency: 1,
        requestsPerSecond: 2 // Very low rate limit
      });

      const startTime = Date.now();
      const processedTimes = [];

      const mockWorker = {
        async process(workItem) {
          processedTimes.push(Date.now() - startTime);
          return { processed: workItem.id };
        }
      };

      queue.workers.set('rate-test', mockWorker);

      // Add 3 items that should be rate limited
      const items = Array(3).fill(null).map((_, i) => ({
        id: `rate-${i}`,
        priority: 1
      }));

      await Promise.all(items.map(item => queue.addWork(item)));

      // With 2 requests per second, 3 items should take at least 1 second
      const totalTime = processedTimes[processedTimes.length - 1];
      assert.ok(totalTime >= 500, `Processing should be rate limited (took ${totalTime}ms)`);
    });
  });
});