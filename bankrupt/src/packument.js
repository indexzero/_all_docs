const { join } = require('path');
const pMap = require('p-map').default;
const pMapSeries = require('p-map-series').default;
const { isJsonCached } = require('./cache');
const { defaults } = require('./http');

const debug = require('debug')('_all_docs/packument');

/**
 * Retrieves the packument for a given package name.
 * @param {string} name
 * @returns {Promise<any>} A promise resolving to the parsed packument.
 */
async function getPackument(name) {
  const agent = defaults.agent;
  const options = {
    origin: 'https://registry.npmjs.com',
    path: `/${encodeURIComponent(name)}`,
    method: 'GET',
    headers: {
      // TODO (cjr): only accept gzip encoding
      // 'accept-encoding': 'gzip;q=1.0, *;q=0.5'

      // TODO (cjr): proper if-none-match, etag handling from prior cache

      accept: 'application/json',

      // TODO (cjr): proper cache-control, starting with the max-age
      // relative to the time since the _all_docs index was fetched
      // for the partition that this packument is within
    }
  };

  debug('getPackument.request |', { name, options });

  const { statusCode, headers, body } = await agent.request(options);

  debug('getPackument.response | ', { name, statusCode, headers });

  const text = await body.text();

  debug('getPackument.text |', { name, text: text.slice(0, 100) });

  // TODO (cjr): always gunzip text prior to JSON parse
  // TODO (cjr): validate the response is a valid packument before returning
  return JSON.parse(text);
}

/**
 * Retrieves packuments for multiple package names with a concurrency limit.
 * @param {string[]} names
 * @param {number} [limit=10]
 * @returns {Promise<any[]>} A promise resolving to an array of packuments.
 */
async function getPackumentsLimit(names, limit = 10) {
  return await pMap(names, async function (name) {
    return await getPackument(name);
  }, { concurrency: limit });
}

/**
 * Caches packuments in series by processing names one at a time.
 * @param {string[]} names
 * @param {(packument: any) => Promise<any>} writeFn
 * @returns {Promise<Number>} A promise resolving to the number of cache misses.
 */
async function cachePackumentsSeries(names, writeFn, { cacheDir }) {
  let misses = 0;
  await pMapSeries(names, async function (name) {
    const filename = join(cacheDir, `${name}.json`);
    if (await isJsonCached(filename)) {
      misses = misses + 1;
      return;
    }

    const packument = await getPackument(name);
    await writeFn(packument);

  }, { concurrency: 1 });

  return misses;
}

/**
 * Caches packuments by processing names by limit.
 * @param {string[]} names
 * @param {(packument: any) => Promise<any>} writeFn
 * @returns {Promise<Number>} A promise resolving to the number of cache misses.
 */
async function cachePackumentsLimit(names, writeFn, { limit, cacheDir }) {
  let misses = 0;
  await pMap(names, async function (name) {
    const filename = join(cacheDir, `${encodeURIComponent(name)}.json`);
    if (await isJsonCached(filename)) {
      return;
    }

    misses = misses + 1;
    const packument = await getPackument(name);
    await writeFn(packument);
  }, { concurrency: limit });

  return misses;
}

module.exports = {
  getPackument,
  getPackumentsLimit,
  cachePackumentsSeries,
  cachePackumentsLimit
};
