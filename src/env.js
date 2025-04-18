/**
 * @typedef {Object} EnvConfig
 * @property {number} CONCURRENCY
 * @property {number} START
 * @property {number} SIZE
 * @property {string} ORIGIN
 * @property {string} USER_AGENT
 * @property {boolean} DRY_RUN
 */

const {
  CONCURRENCY,
  START, 
  SIZE,
  ORIGIN = 'https://replicate.npmjs.com',
  USER_AGENT = '_all_docs/0.0.0 (https://github.com/indexzero/_all_docs)',
  DRY_RUN
} = process.env;

/** @type {EnvConfig} */
module.exports = {
  CONCURRENCY: parseInt(CONCURRENCY) || 10,
  START: parseInt(START) || 0,
  SIZE: parseInt(SIZE) || 0,
  ORIGIN,
  USER_AGENT,
  DRY_RUN: DRY_RUN === 'true'
};
