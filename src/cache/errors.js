/**
 * Custom error classes for HTTP client operations
 * Three categories: Auth (stop), Temporary (retry), Permanent (skip)
 */

/**
 * Authentication error - should stop immediately
 * Used for 401 Unauthorized and 403 Forbidden responses
 */
export class AuthError extends Error {
  constructor(message, statusCode, url) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
    this.url = url;
    this.category = 'auth';
    this.shouldRetry = false;
  }
}

/**
 * Temporary error - should retry with backoff
 * Used for network errors, 429 Too Many Requests, 5xx server errors
 */
export class TempError extends Error {
  constructor(message, statusCode, url) {
    super(message);
    this.name = 'TempError';
    this.statusCode = statusCode;
    this.url = url;
    this.category = 'temporary';
    this.shouldRetry = true;
  }
}

/**
 * Permanent error - should skip and continue
 * Used for 400 Bad Request, 404 Not Found, and other 4xx errors
 */
export class PermError extends Error {
  constructor(message, statusCode, url) {
    super(message);
    this.name = 'PermError';
    this.statusCode = statusCode;
    this.url = url;
    this.category = 'permanent';
    this.shouldRetry = false;
  }
}

/**
 * Categorize HTTP errors based on status code
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @param {string} url - Request URL
 * @returns {Error} Appropriate error instance
 */
export function categorizeHttpError(statusCode, message, url) {
  // Authentication errors - stop immediately
  if (statusCode === 401 || statusCode === 403) {
    return new AuthError(message, statusCode, url);
  }

  // Temporary errors - retry with backoff
  if (statusCode === 429 || (statusCode >= 500 && statusCode < 600)) {
    return new TempError(message, statusCode, url);
  }

  // Permanent errors - skip and continue
  if (statusCode >= 400 && statusCode < 500) {
    return new PermError(message, statusCode, url);
  }

  // Default to temporary for unknown status codes
  return new TempError(message, statusCode, url);
}