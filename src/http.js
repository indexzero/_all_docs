const { Agent, RetryAgent } = require('undici');

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

module.exports = {
  default: {
    agent,
    dispatch,
    config: agentDefaults
  }
};
