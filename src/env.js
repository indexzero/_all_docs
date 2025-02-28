const {
  CONCURRENCY,
  START, 
  LIMIT,
  ORIGIN = 'https://replicate.npmjs.com',
  USER_AGENT = '_all_docs/0.0.0 (https://github.com/indexzero/_all_docs)',
  DRY_RUN
} = process.env;

module.exports = {
  CONCURRENCY: parseInt(CONCURRENCY) || 10,
  START: parseInt(START) || 0,
  LIMIT: parseInt(LIMIT) || 1000,
  ORIGIN,
  USER_AGENT,
  DRY_RUN: DRY_RUN === 'true'
}
