/**
 * @typedef {Object} FrameDefaults
 * @property {number} concurrency
 * @property {number} start
 * @property {number} size
 * @property {string} userAgent
 * @property {boolean} dryRun
 * @property {Object} origins
 * @property {string} origins.packument
 * @property {string} origins.partition
 */

const defaults = {
  concurrency: 10,
  start: 0,
  size: 2000,
  userAgent: '_all_docs/0.0.0 (https://github.com/indexzero/_all_docs)',
  dryRun: false,
  origins: {
    packument: 'https://registry.npmjs.com',
    partition: 'https://replicate.npmjs.com',
  }
};

export {
  defaults
};
