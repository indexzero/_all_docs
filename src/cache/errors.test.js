import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { AuthError, TempError, PermError, categorizeHttpError } from './errors.js';

test('Error Classes', async (t) => {
  await t.test('AuthError properties', () => {
    const error = new AuthError('Unauthorized', 401, 'https://example.com/api');

    assert.equal(error.name, 'AuthError');
    assert.equal(error.message, 'Unauthorized');
    assert.equal(error.statusCode, 401);
    assert.equal(error.url, 'https://example.com/api');
    assert.equal(error.category, 'auth');
    assert.equal(error.shouldRetry, false);
    assert.ok(error instanceof Error);
  });

  await t.test('TempError properties', () => {
    const error = new TempError('Service Unavailable', 503, 'https://example.com/api');

    assert.equal(error.name, 'TempError');
    assert.equal(error.message, 'Service Unavailable');
    assert.equal(error.statusCode, 503);
    assert.equal(error.url, 'https://example.com/api');
    assert.equal(error.category, 'temporary');
    assert.equal(error.shouldRetry, true);
    assert.ok(error instanceof Error);
  });

  await t.test('PermError properties', () => {
    const error = new PermError('Not Found', 404, 'https://example.com/api');

    assert.equal(error.name, 'PermError');
    assert.equal(error.message, 'Not Found');
    assert.equal(error.statusCode, 404);
    assert.equal(error.url, 'https://example.com/api');
    assert.equal(error.category, 'permanent');
    assert.equal(error.shouldRetry, false);
    assert.ok(error instanceof Error);
  });

  await t.test('categorizeHttpError for auth errors', () => {
    const error401 = categorizeHttpError(401, 'Unauthorized', 'https://example.com');
    assert.ok(error401 instanceof AuthError);
    assert.equal(error401.statusCode, 401);

    const error403 = categorizeHttpError(403, 'Forbidden', 'https://example.com');
    assert.ok(error403 instanceof AuthError);
    assert.equal(error403.statusCode, 403);
  });

  await t.test('categorizeHttpError for temporary errors', () => {
    const error429 = categorizeHttpError(429, 'Too Many Requests', 'https://example.com');
    assert.ok(error429 instanceof TempError);
    assert.equal(error429.statusCode, 429);

    const error500 = categorizeHttpError(500, 'Internal Server Error', 'https://example.com');
    assert.ok(error500 instanceof TempError);
    assert.equal(error500.statusCode, 500);

    const error502 = categorizeHttpError(502, 'Bad Gateway', 'https://example.com');
    assert.ok(error502 instanceof TempError);
    assert.equal(error502.statusCode, 502);

    const error503 = categorizeHttpError(503, 'Service Unavailable', 'https://example.com');
    assert.ok(error503 instanceof TempError);
    assert.equal(error503.statusCode, 503);
  });

  await t.test('categorizeHttpError for permanent errors', () => {
    const error400 = categorizeHttpError(400, 'Bad Request', 'https://example.com');
    assert.ok(error400 instanceof PermError);
    assert.equal(error400.statusCode, 400);

    const error404 = categorizeHttpError(404, 'Not Found', 'https://example.com');
    assert.ok(error404 instanceof PermError);
    assert.equal(error404.statusCode, 404);

    const error405 = categorizeHttpError(405, 'Method Not Allowed', 'https://example.com');
    assert.ok(error405 instanceof PermError);
    assert.equal(error405.statusCode, 405);

    const error410 = categorizeHttpError(410, 'Gone', 'https://example.com');
    assert.ok(error410 instanceof PermError);
    assert.equal(error410.statusCode, 410);
  });

  await t.test('categorizeHttpError defaults to temporary for unknown codes', () => {
    const error999 = categorizeHttpError(999, 'Unknown Error', 'https://example.com');
    assert.ok(error999 instanceof TempError);
    assert.equal(error999.statusCode, 999);
  });
});