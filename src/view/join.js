/**
 * Join execution for views
 */
import { createProjection, createFilter } from './projection.js';
import { queryView } from './query.js';

/**
 * Create a cache key for a packument using a pre-encoded origin
 * (The view.origin is already encoded, so we don't re-encode)
 */
function createPackumentKeyRaw(packageName, encodedOrigin) {
  const nameHex = Array.from(new TextEncoder().encode(packageName))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `v1:packument:${encodedOrigin}:${nameHex}`;
}

/**
 * Join two views on a common key
 * @param {View} leftView - Left side of join
 * @param {View} rightView - Right side of join
 * @param {Cache} cache - The cache instance
 * @param {Object} options - Join options
 * @param {string} [options.on='name'] - Field to join on
 * @param {string} [options.type='left'] - Join type: left, inner, right, full
 * @param {string} [options.select] - Output projection
 * @param {string} [options.where] - Post-join filter
 * @param {boolean} [options.progress] - Show progress on stderr
 * @yields {Object} Joined records
 */
export async function* joinViews(leftView, rightView, cache, options = {}) {
  const {
    on = 'name',
    type = 'left',
    select,
    where,
    progress = false
  } = options;

  // Handle right join by swapping
  if (type === 'right') {
    yield* joinViews(rightView, leftView, cache, {
      ...options,
      type: 'left',
      select: select?.replace(/\.left\b/g, '.__LEFT__')
        .replace(/\.right\b/g, '.left')
        .replace(/\.__LEFT__\b/g, '.right')
    });
    return;
  }

  // Handle full join
  if (type === 'full') {
    yield* fullJoin(leftView, rightView, cache, options);
    return;
  }

  // Left join or inner join
  yield* leftOrInnerJoin(leftView, rightView, cache, options);
}

/**
 * Left or inner join implementation
 */
async function* leftOrInnerJoin(leftView, rightView, cache, options) {
  const {
    on = 'name',
    type = 'left',
    select,
    where,
    limit,
    progress = false
  } = options;

  const project = createProjection({ select });
  const filter = createFilter({ where });

  // Compile left view's projection
  const projectLeft = createProjection({ select: leftView.select });

  // Compile right view's projection
  const projectRight = createProjection({ select: rightView.select });

  let count = 0;
  let yielded = 0;

  // Stream the left view
  for await (const key of cache.keys(leftView.getCacheKeyPrefix())) {
    // Check limit
    if (limit && yielded >= limit) break;

    count++;

    if (progress && count % 5000 === 0) {
      process.stderr.write(`\rJoin: processed ${count}, yielded ${yielded}...`);
    }

    try {
      const leftEntry = await cache.fetch(key);
      if (!leftEntry) continue;

      // Cache entries wrap the response - packument is in body
      const leftValue = leftEntry.body || leftEntry;
      const leftRecord = projectLeft(leftValue);
      const joinKey = leftRecord[on];

      if (!joinKey) continue;

      // Construct the right cache key directly - O(1) lookup!
      const rightCacheKey = createPackumentKeyRaw(joinKey, rightView.origin);

      let rightRecord = null;
      try {
        const rightEntry = await cache.fetch(rightCacheKey);
        if (rightEntry) {
          const rightValue = rightEntry.body || rightEntry;
          rightRecord = projectRight(rightValue);
        }
      } catch {
        // Right record not found
      }

      // Inner join: skip if no right match
      if (type === 'inner' && !rightRecord) continue;

      // Build joined record
      const joined = {
        [on]: joinKey,
        left: leftRecord,
        right: rightRecord
      };

      // Apply post-join projection
      const result = project(joined);

      // Apply post-join filter
      if (!filter(result)) continue;

      yielded++;
      yield result;
    } catch (err) {
      if (progress) {
        process.stderr.write(`\nError in join: ${err.message}\n`);
      }
    }
  }

  if (progress) {
    process.stderr.write(`\rJoin: processed ${count}, yielded ${yielded}    \n`);
  }
}

/**
 * Full outer join implementation
 */
async function* fullJoin(leftView, rightView, cache, options) {
  const {
    on = 'name',
    select,
    where,
    limit,
    progress = false
  } = options;

  const project = createProjection({ select });
  const filter = createFilter({ where });
  const projectLeft = createProjection({ select: leftView.select });
  const projectRight = createProjection({ select: rightView.select });

  // Track which right keys we've seen
  const seenRightKeys = new Set();

  let count = 0;
  let yielded = 0;

  // First pass: left join
  for await (const key of cache.keys(leftView.getCacheKeyPrefix())) {
    // Check limit
    if (limit && yielded >= limit) break;

    count++;

    if (progress && count % 5000 === 0) {
      process.stderr.write(`\rFull join pass 1: processed ${count}...`);
    }

    try {
      const leftEntry = await cache.fetch(key);
      if (!leftEntry) continue;

      const leftValue = leftEntry.body || leftEntry;
      const leftRecord = projectLeft(leftValue);
      const joinKey = leftRecord[on];

      if (!joinKey) continue;

      const rightCacheKey = createPackumentKeyRaw(joinKey, rightView.origin);

      let rightRecord = null;
      try {
        const rightEntry = await cache.fetch(rightCacheKey);
        if (rightEntry) {
          const rightValue = rightEntry.body || rightEntry;
          rightRecord = projectRight(rightValue);
          seenRightKeys.add(joinKey);
        }
      } catch {
        // Right not found
      }

      const joined = {
        [on]: joinKey,
        left: leftRecord,
        right: rightRecord
      };

      const result = project(joined);
      if (!filter(result)) continue;

      yielded++;
      yield result;
    } catch {
      // Skip errors
    }
  }

  if (progress) {
    process.stderr.write(`\rFull join pass 2: scanning right side...          \n`);
  }

  // Second pass: right-only records
  let rightCount = 0;
  for await (const key of cache.keys(rightView.getCacheKeyPrefix())) {
    // Check limit
    if (limit && yielded >= limit) break;

    rightCount++;

    if (progress && rightCount % 5000 === 0) {
      process.stderr.write(`\rFull join pass 2: processed ${rightCount}...`);
    }

    try {
      const rightEntry = await cache.fetch(key);
      if (!rightEntry) continue;

      const rightValue = rightEntry.body || rightEntry;
      const rightRecord = projectRight(rightValue);
      const joinKey = rightRecord[on];

      if (!joinKey || seenRightKeys.has(joinKey)) continue;

      const joined = {
        [on]: joinKey,
        left: null,
        right: rightRecord
      };

      const result = project(joined);
      if (!filter(result)) continue;

      yielded++;
      yield result;
    } catch {
      // Skip errors
    }
  }

  if (progress) {
    process.stderr.write(`\rFull join complete: yielded ${yielded}            \n`);
  }
}

/**
 * Compute set difference between two views
 * Returns records from left that don't exist in right
 */
export async function* diffViews(leftView, rightView, cache, options = {}) {
  yield* joinViews(leftView, rightView, cache, {
    ...options,
    type: 'left',
    where: options.where ? `${options.where} && right == null` : 'right == null'
  });
}
