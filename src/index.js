const https = require('node:https');
const fs = require('node:fs');
const { writeFile } = require('node:fs/promises');
const { pipeline } = require('node:stream/promises');

const debug = require('debug')('_all_docs/request');
const nano = require('nano');
const pRetry = require('p-retry').default;

const {
  ORIGIN,
  USER_AGENT
} = require('./env');

const defaultAgent = new https.Agent({
  keepAlive: true,
  timeout: 60000,
  keepAliveMsecs: 30000,
  maxSockets: 512,
  maxFreeSockets: 256,
  maxTotalSockets: 1024,
  scheduling: 'fifo'
});

const defaults = {
  agent: defaultAgent,
  registry: nano({
    url: ORIGIN,
    requestDefaults: {
      agent: defaultAgent,
      timeout: 30000,
      headers: {
        'user-agent': USER_AGENT,
        'Accept-Encoding': 'deflate, gzip',
        'content-type': 'application/json',
        accept: 'application/json',
      },
    },
  }).use('registry')
};

async function getPartition({ partition, ...relax }) {
  const registry = relax.registry || defaults.registry;
  const { startKey, endKey, filename } = partition;

  const listOptions = {
    start_key: startKey,
    end_key: endKey,
    include_docs: false
  };

  async function getAttempt() {
    debug(`GET /registry/_all_docs?start_key="${startKey}"&end_key="${endKey}"&include_docs=false`);
    return await registry.list(listOptions);
  }

  try {
    return await pRetry(getAttempt, {
      retries: 3,
      factor: 1.5,
      minTimeout: 10 * 1000,
      maxTimeout: 60 * 1000,
      randomize: true,
      onFailedAttempt: (err) => {
        const { attemptNumber } = err;
        debug(`${attemptNumber}💥 GET /registry/_all_docs?start_key="${startKey}"&end_key="${endKey}"&include_docs=false`);
      }
    });
  } catch (err) {
    if (relax.requeue) {
      relax.requeue(err, partition);
    }
  }
}


async function writePartition(options) {
  const results = await getPartition(options);
  const { filename } = options.partition;
  if (results) {
    await writeFile(filename, JSON.stringify(results));
  }

  return { filename, results };
}

async function createWriteStream({ partition, ...relax }) {
  const registry = relax.registry || defaults.registry;
  const { startKey, endKey, filename } = partition;

  const listOptions = {
    start_key: startKey,
    end_key: endKey,
    include_docs: false
  };

  debug(`GET /registry/_all_docs?start_key="${startKey}"&end_key="${endKey}"&include_docs=false`);

  try {
    await pipeline(
      registry.listAsStream(listOptions),
      fs.createWriteStream(filename)
    )
  } catch (err) {
    debug(`💥 GET /registry/_all_docs?start_key="${startKey}"&end_key="${endKey}"&include_docs=false`);
  }
}

module.exports = {
  getPartition,
  writePartition,
  createWriteStream
}
