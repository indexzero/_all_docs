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
      config: this.xdg.config(),
      logs: this.xdg.data('logs'),
      sessions: this.xdg.data('sessions')
    };

    // Parse .npmrc file synchronously at startup
    this.npmrc = new NpmrcParser(cli.values.rcfile);

    // Determine auth credentials with precedence:
    // 1. CLI flag (--token or --auth)
    // 2. Environment variable (NPM_TOKEN, ALL_DOCS_TOKEN)
    // 3. .npmrc file
    this.authToken = this.#resolveAuthToken();
    this.auth = this.#resolveAuth();
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
    if (this.cli.values.token) {
      return this.cli.values.token;
    }

    // 2. Check environment variables
    // NPM_TOKEN is the standard npm environment variable for auth
    if (process.env.NPM_TOKEN) {
      return process.env.NPM_TOKEN;
    }

    // 3. Check .npmrc file
    if (this.npmrc.hasTokens()) {
      const registry = this.cli.values.registry || 'https://registry.npmjs.org';
      return this.npmrc.getToken(registry);
    }

    return undefined;
  }

  /**
   * Resolve Basic auth credentials with proper precedence
   * @returns {string|undefined} Basic auth credentials if found
   */
  #resolveAuth() {
    // 1. Check CLI flag
    if (this.cli.values.auth) {
      return this.cli.values.auth;
    }

    // 2. Check environment variables
    // _ALL_DOCS_AUTH takes precedence (jackspeak will auto-map this)
    if (process.env._ALL_DOCS_AUTH) {
      return process.env._ALL_DOCS_AUTH;
    }

    // 3. Check .npmrc file for _auth field
    const registry = this.getRegistry();
    if (this.npmrc.hasAuth()) {
      return this.npmrc.getAuth(registry);
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
