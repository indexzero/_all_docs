/**
 * Cache key utilities for cross-platform storage compatibility
 * Uses versioned hex encoding to ensure keys work across all backends
 */

const CACHE_KEY_VERSION = 'v1';

/**
 * Create a cache key for a partition
 * @param {string} startKey - Start key of the partition
 * @param {string} endKey - End key of the partition
 * @param {string} origin - Registry origin URL
 * @returns {string} Versioned cache key
 */
export function createPartitionKey(startKey, endKey, origin = 'https://replicate.npmjs.com') {
  const originKey = encodeOrigin(origin);
  const startHex = encodeKeySegment(startKey);
  const endHex = encodeKeySegment(endKey);
  
  return `${CACHE_KEY_VERSION}:partition:${originKey}:${startHex}:${endHex}`;
}

/**
 * Create a cache key for a packument
 * @param {string} packageName - npm package name
 * @param {string} origin - Registry origin URL
 * @returns {string} Versioned cache key
 */
export function createPackumentKey(packageName, origin = 'https://registry.npmjs.com') {
  const originKey = encodeOrigin(origin);
  const nameHex = encodeKeySegment(packageName);
  
  return `${CACHE_KEY_VERSION}:packument:${originKey}:${nameHex}`;
}

/**
 * Encode origin URL to short key
 * @param {string} origin - Full origin URL
 * @returns {string} Short origin key
 */
function encodeOrigin(origin) {
  // Use short aliases for common registries
  if (origin === 'https://replicate.npmjs.com') return 'npm';
  if (origin === 'https://registry.npmjs.org') return 'npm';
  if (origin === 'https://registry.npmjs.com') return 'npm';
  
  // For custom registries, use first 8 chars of base64url
  const encoder = new TextEncoder();
  const bytes = encoder.encode(origin);
  // Simple base64url encoding for edge compatibility
  const base64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  return base64.substring(0, 8);
}

/**
 * Encode a key segment to hex
 * @param {string} segment - Key segment to encode
 * @returns {string} Hex encoded segment
 */
function encodeKeySegment(segment) {
  if (!segment) return '';
  const encoder = new TextEncoder();
  const bytes = encoder.encode(segment);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Decode a cache key back to its components
 * @param {string} cacheKey - The cache key to decode
 * @returns {Object} Decoded components
 */
export function decodeCacheKey(cacheKey) {
  const parts = cacheKey.split(':');
  if (parts.length < 4) {
    throw new Error(`Invalid cache key format: ${cacheKey}`);
  }
  
  const [version, type, origin, ...segments] = parts;
  
  if (type === 'partition' && segments.length === 2) {
    return {
      version,
      type,
      origin: decodeOrigin(origin),
      startKey: decodeKeySegment(segments[0]),
      endKey: decodeKeySegment(segments[1])
    };
  } else if (type === 'packument' && segments.length === 1) {
    return {
      version,
      type,
      origin: decodeOrigin(origin),
      packageName: decodeKeySegment(segments[0])
    };
  }
  
  throw new Error(`Unknown cache key type: ${type}`);
}

/**
 * Decode origin from short key
 * @param {string} originKey - Short origin key
 * @returns {string} Full origin URL
 */
function decodeOrigin(originKey) {
  if (originKey === 'npm') return 'https://registry.npmjs.com';
  
  // For custom registries, decode from base64url
  // Note: This is lossy - we only stored first 8 chars
  return `<custom:${originKey}>`;
}

/**
 * Decode a hex segment back to string
 * @param {string} hexSegment - Hex encoded segment
 * @returns {string} Decoded string
 */
function decodeKeySegment(hexSegment) {
  if (!hexSegment) return '';
  // Convert hex string to bytes
  const bytes = [];
  for (let i = 0; i < hexSegment.length; i += 2) {
    bytes.push(parseInt(hexSegment.substr(i, 2), 16));
  }
  const decoder = new TextDecoder();
  return decoder.decode(new Uint8Array(bytes));
}

/**
 * Factory function to create appropriate cache key
 * @param {string} type - 'partition' or 'packument'
 * @param {Object} params - Parameters for key creation
 * @returns {string} Cache key
 */
export function createCacheKey(type, params) {
  switch (type) {
    case 'partition':
      return createPartitionKey(params.startKey, params.endKey, params.origin);
    case 'packument':
      return createPackumentKey(params.packageName, params.origin);
    default:
      throw new Error(`Unknown cache key type: ${type}`);
  }
}