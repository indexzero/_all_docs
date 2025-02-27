const fs = require('node:fs');
const https = require('node:https');
const { pipeline } = require('node:stream/promises');

const nano = require('nano');

const {
  CONCURRENCY,
  START, 
  LIMIT,
  USER_AGENT = '_all_docs/0.0.0 (https://github.com/indexzero/_all_docs)',
  DRY_RUN
} = process.env;

const httpsAgent = new https.Agent({
  keepAlive: true,
  timeout: 60000,
  maxFreeSockets: 2000,
  scheduling: 'fifo',
});

const relax = nano({
  url: 'https://replicate.npmjs.com',
  requestDefaults: {
    agent: httpsAgent,
    timeout: 30000,
    headers: {
      'user-agent': USER_AGENT,
      'Accept-Encoding': 'deflate, gzip',
      'content-type': 'application/json',
      accept: 'application/json',
    },
  },
});

const registry = relax.use('registry');



async function allDocsForPartition(partition) {
  const { startKey, endKey, filename } = partition;
  const listOptions = {
    start_key: startKey,
    end_key: endKey,
    include_docs: false
  };

  console.log(`GET /registry/_all_docs?start_key="${startKey}"&end_key="${endKey}"&include_docs=false`);

  try {
    await pipeline(
      registry.listAsStream(listOptions),
      fs.createWriteStream(filename)
    )
  } catch (err) {
    console.log(`💥 GET /registry/_all_docs?start_key="${startKey}"&end_key="${endKey}"&include_docs=false`);
  }
}

module.exports = {
  allDocsForPartition
}
