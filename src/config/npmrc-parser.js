import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parse as parseIni } from 'ini';

/**
 * .npmrc parser using the standard ini package
 * Reads and parses .npmrc file once at startup
 */
export class NpmrcParser {
  #config = {};
  #registry = 'https://registry.npmjs.org/';

  /**
   * Create a new NpmrcParser instance
   * @param {string} [npmrcPath] - Path to .npmrc file (defaults to ~/.npmrc)
   */
  constructor(npmrcPath) {
    // Use provided path or default to ~/.npmrc
    const path = npmrcPath || join(homedir(), '.npmrc');

    if (existsSync(path)) {
      this.#parse(path);
    }
  }

  /**
   * Parse .npmrc file synchronously using ini package
   * @param {string} path - Path to .npmrc file
   */
  #parse(path) {
    try {
      const content = readFileSync(path, 'utf8');
      this.#config = parseIni(content);

      // Extract registry setting if present
      if (this.#config.registry) {
        this.#registry = this.#config.registry;
        // Ensure trailing slash for compatibility
        if (!this.#registry.endsWith('/')) {
          this.#registry = this.#registry + '/';
        }
      }
    } catch (err) {
      // Log warning but continue with defaults
      console.warn(`Warning: Failed to parse .npmrc at ${path}:`, err.message);
    }
  }

  /**
   * Get auth token for a registry URL
   * @param {string} registryUrl - Registry URL
   * @returns {string|undefined} Auth token if found
   */
  getToken(registryUrl) {
    if (!registryUrl) {
      registryUrl = this.#registry;
    }

    let host;
    try {
      // If it looks like a URL, parse it
      if (registryUrl.includes('://')) {
        const url = new URL(registryUrl);
        host = url.host;
      } else {
        // Treat it as a hostname/host:port
        host = registryUrl.replace(/\/$/, ''); // Remove trailing slash if any
      }
    } catch {
      // Invalid URL, try as plain hostname
      host = registryUrl;
    }

    // Try different key formats that npm uses
    // Format 1: //registry.npmjs.org/:_authToken
    const key1 = `//${host}/:_authToken`;
    if (this.#config[key1]) {
      return this.#config[key1];
    }

    // Format 2: //registry.npmjs.org:_authToken
    const key2 = `//${host}:_authToken`;
    if (this.#config[key2]) {
      return this.#config[key2];
    }

    // Format 3: //registry.npmjs.org/_authToken (some npm versions)
    const key3 = `//${host}/_authToken`;
    if (this.#config[key3]) {
      return this.#config[key3];
    }

    // Also try hostname only (without port) if host includes a port
    if (host.includes(':')) {
      const hostname = host.split(':')[0];
      const hostOnly1 = `//${hostname}/:_authToken`;
      const hostOnly2 = `//${hostname}:_authToken`;

      if (this.#config[hostOnly1]) {
        return this.#config[hostOnly1];
      }
      if (this.#config[hostOnly2]) {
        return this.#config[hostOnly2];
      }
    }

    return undefined;
  }

  /**
   * Get the default registry URL from .npmrc
   * @returns {string} Registry URL
   */
  getRegistry() {
    return this.#registry;
  }

  /**
   * Check if any tokens are configured
   * @returns {boolean} True if tokens exist
   */
  hasTokens() {
    // Check for any auth token keys in the config
    return Object.keys(this.#config).some(key =>
      key.includes('_authToken')
    );
  }

  /**
   * Check if any Basic auth credentials are configured
   * @returns {boolean} True if Basic auth exists
   */
  hasAuth() {
    // Check for _auth keys in the config
    return Object.keys(this.#config).some(key =>
      key.includes('_auth') && !key.includes('_authToken')
    );
  }

  /**
   * Get Basic auth credentials for a registry URL
   * @param {string} registryUrl - Registry URL
   * @returns {string|undefined} Decoded Basic auth credentials (user:pass)
   */
  getAuth(registryUrl) {
    if (!registryUrl) {
      registryUrl = this.#registry;
    }

    let host;
    try {
      // If it looks like a URL, parse it
      if (registryUrl.includes('://')) {
        const url = new URL(registryUrl);
        host = url.host;
      } else {
        // Treat it as a hostname/host:port
        host = registryUrl.replace(/\/$/, ''); // Remove trailing slash if any
      }
    } catch {
      // Invalid URL, try as plain hostname
      host = registryUrl;
    }

    // Try different key formats that npm uses for _auth
    // Format 1: //registry.npmjs.org/:_auth
    const key1 = `//${host}/:_auth`;
    if (this.#config[key1]) {
      // Decode base64 to get user:pass
      try {
        return Buffer.from(this.#config[key1], 'base64').toString('utf8');
      } catch {
        console.warn(`Failed to decode _auth for ${host}`);
        return undefined;
      }
    }

    // Format 2: //registry.npmjs.org:_auth
    const key2 = `//${host}:_auth`;
    if (this.#config[key2]) {
      try {
        return Buffer.from(this.#config[key2], 'base64').toString('utf8');
      } catch {
        console.warn(`Failed to decode _auth for ${host}`);
        return undefined;
      }
    }

    // Also try hostname only (without port) if host includes a port
    if (host.includes(':')) {
      const hostname = host.split(':')[0];
      const hostOnly1 = `//${hostname}/:_auth`;
      const hostOnly2 = `//${hostname}:_auth`;

      if (this.#config[hostOnly1]) {
        try {
          return Buffer.from(this.#config[hostOnly1], 'base64').toString('utf8');
        } catch {
          console.warn(`Failed to decode _auth for ${hostname}`);
        }
      }
      if (this.#config[hostOnly2]) {
        try {
          return Buffer.from(this.#config[hostOnly2], 'base64').toString('utf8');
        } catch {
          console.warn(`Failed to decode _auth for ${hostname}`);
        }
      }
    }

    return undefined;
  }

  /**
   * Get the raw parsed config (for testing)
   * @returns {Object} Parsed config object
   */
  getRawConfig() {
    return { ...this.#config };
  }
}