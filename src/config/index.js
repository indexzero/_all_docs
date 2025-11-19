import process from 'node:process';
import { XDG } from '@vltpkg/xdg';
import { NpmrcParser } from './npmrc-parser.js';

export default class Config {
  constructor(cli) {
    this.cli = cli;
    this.xdg = new XDG('_all_docs');

    this.dirs = {
      partitions: this.xdg.cache('partitions'),
      packuments: this.xdg.cache('packuments'),
      logs: this.xdg.data('logs'),
      sessions: this.xdg.data('sessions')
    };

    // Parse .npmrc file synchronously at startup
    this.npmrc = new NpmrcParser(cli.values.rcfile);

    // Determine auth token with precedence:
    // 1. CLI flag (--auth-token)
    // 2. Environment variable (NPM_TOKEN or npm_config_//registry/_authToken)
    // 3. .npmrc file
    this.authToken = this.#resolveAuthToken();
  }

  get(key) {
    return this.cli.values[key];
  }

  dir(which) {
    if (this.dirs[which]) {
      return this.dirs[which];
    }
  }

  usage() {
    return this.cli.usage();
  }

  get values() {
    return this.cli.values;
  }

  get _() {
    return this.cli._;
  }

  /**
   * Resolve authentication token with proper precedence
   * @returns {string|undefined} Authentication token if found
   */
  #resolveAuthToken() {
    // 1. Check CLI flag
    if (this.cli.values.authToken) {
      return this.cli.values.authToken;
    }

    // 2. Check environment variables
    // NPM_TOKEN takes precedence
    if (process.env.NPM_TOKEN) {
      return process.env.NPM_TOKEN;
    }

    // Check npm_config_ style environment variables
    // Format: npm_config_//registry.npmjs.org/:_authToken
    const registry = this.cli.values.registry || 'https://registry.npmjs.org';
    const registryHost = new URL(registry).host;
    const envKey = `npm_config_//${registryHost}/:_authToken`;
    const envKeyNormalized = envKey.replace(/[^a-zA-Z0-9_]/g, '_');

    if (process.env[envKeyNormalized]) {
      return process.env[envKeyNormalized];
    }

    // 3. Check .npmrc file
    if (this.npmrc.hasTokens()) {
      return this.npmrc.getToken(registry);
    }

    return undefined;
  }

  /**
   * Get the effective registry URL
   * @returns {string} Registry URL
   */
  getRegistry() {
    return this.cli.values.registry || this.npmrc.getRegistry();
  }
}
