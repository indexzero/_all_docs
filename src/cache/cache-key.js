/**
 * Cache key utilities for cross-platform storage compatibility
 * Uses versioned hex encoding to ensure keys work across all backends
 */

const CACHE_KEY_VERSION = 'v1';

const NPM_HOSTS = new Set([
  'registry.npmjs.com',
  'registry.npmjs.org',
  'replicate.npmjs.com'
]);

/**
 * Truncate a segment for compact cache keys
 * If segment is 5 chars or less, keep whole. Otherwise, first 3 + last 2.
 * @param {string} segment - Segment to truncate
 * @returns {string} Truncated segment
 */
function truncateSegment(segment) {
  if (segment.length <= 5) return segment;
  return segment.slice(0, 3) + segment.slice(-2);
}

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
 * Encode origin URL to short, readable key
 * Format: [http~]hostname[~port][~path~segments]
 * - HTTPS is implicit (only prefix http~ for HTTP)
 * - Each segment truncated: <=5 chars kept whole, else first 3 + last 2
 * - Hostname uses . separator, port/path use ~ separator
 * @param {string} origin - Full origin URL
 * @returns {string} Short origin key
 */
function encodeOrigin(origin) {
  // Handle bare hostnames (no protocol)
  if (!origin.includes('://')) {
    origin = 'https://' + origin;
  }

  const url = new URL(origin);
  const hostname = url.hostname.toLowerCase();
  const isHttp = url.protocol === 'http:';
  const isDefaultPort =
    !url.port ||
    (url.protocol === 'https:' && url.port === '443') ||
    (url.protocol === 'http:' && url.port === '80');
  const pathSegments = url.pathname.split('/').filter(Boolean);

  // Check npm alias
  if (NPM_HOSTS.has(hostname) && isDefaultPort && pathSegments.length === 0) {
    return 'npm';
  }

  // Truncate hostname segments (split by .)
  const truncatedHost = hostname
    .split('.')
    .map(truncateSegment)
    .join('.');

  // Build parts array
  const parts = [];
  if (isHttp) parts.push('http');
  parts.push(truncatedHost);
  if (!isDefaultPort && url.port) parts.push(url.port);
  parts.push(...pathSegments.map(truncateSegment));

  return parts.join('~');
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
 * Decode origin from short key (best-effort reconstruction)
 * Handles both old base64 format and new readable format
 * @param {string} originKey - Short origin key
 * @returns {string} Reconstructed origin URL (may not match original exactly)
 */
function decodeOrigin(originKey) {
  if (originKey === 'npm') return 'https://registry.npmjs.com';

  // Detect new readable format: contains '.' (hostname) or '~' (separator)
  if (originKey.includes('.') || originKey.includes('~')) {
    // New readable format
    const isHttp = originKey.startsWith('http~');
    const protocol = isHttp ? 'http://' : 'https://';
    const remainder = isHttp ? originKey.slice(5) : originKey;

    // Split on ~ to get hostname and path/port parts
    const parts = remainder.split('~');
    const hostname = parts[0];
    const rest = parts.slice(1);

    // Reconstruct URL (note: truncated segments cannot be fully recovered)
    if (rest.length === 0) {
      return `${protocol}${hostname}`;
    }
    return `${protocol}${hostname}/${rest.join('/')}`;
  }

  // Old base64 format - cannot decode meaningfully
  return `<legacy:${originKey}>`;
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