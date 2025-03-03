const { Agent, RetryAgent } = require('undici');
const pMap = require('p-map').default;
const pMapSeries = require('p-map-series').default;
const debug = require('debug')('_all_docs/packument');

/** @type {import('undici').AgentOptions} */
const agentDefaults = {
  bodyTimeout: 600_000,
  headersTimeout: 600_000,
  keepAliveMaxTimeout: 1_200_000,
  keepAliveTimeout: 600_000,
  keepAliveTimeoutThreshold: 30_000,
  connect: {
    timeout: 600_000,
    keepAlive: true,
    keepAliveInitialDelay: 30_000,
    sessionTimeout: 600,
  },
  connections: 128,
  pipelining: 10
};

/** @type {import('undici').Agent} */
const dispatch = new Agent(agentDefaults);

/** @type {import('undici').RetryAgent} */
const agent = new RetryAgent(dispatch, {
  maxRetries: 3,
  timeoutFactor: 2,
  minTimeout: 0,
  maxTimeout: 30_000
});

/**
 * Retrieves the packument for a given package name.
 * @param {string} name
 * @returns {Promise<any>} A promise resolving to the parsed packument.
 */
async function getPackument(name) {
  const options = {
    origin: 'https://replicate.npmjs.com',
    path: `/${name}`,
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

  debug('getPackument.text |', { name, text });

  // TODO (cjr): always gunzip text prior to JSON parse
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
 * @returns {Promise<any[]>} A promise resolving to an array of cached packuments.
 */
async function cachePackumentsSeries(names, writeFn) {
  return await pMapSeries(names, async function (name) {
    const packument = await getPackument(name);
    await writeFn(packument);
    return packument;
  }, { concurrency: 1 });
}

module.exports = {
  getPackument,
  getPackumentsLimit,
  cachePackumentsSeries
};
