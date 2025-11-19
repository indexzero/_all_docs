import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Simple synchronous .npmrc parser
 * Reads and parses .npmrc file once at startup
 */
export class NpmrcParser {
  #tokens = new Map();
  #registry = 'https://registry.npmjs.org';

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
   * Parse .npmrc file synchronously
   * @param {string} path - Path to .npmrc file
   */
  #parse(path) {
    const content = readFileSync(path, 'utf8');
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) {
        continue;
      }

      // Parse registry setting
      if (trimmed.startsWith('registry=')) {
        this.#registry = trimmed.substring('registry='.length).trim();
        continue;
      }

      // Parse auth tokens
      // Format: //registry.npmjs.org/:_authToken=TOKEN
      const tokenMatch = trimmed.match(/^\/\/([^/]+)\/:_authToken=(.+)$/);
      if (tokenMatch) {
        const [, host, token] = tokenMatch;
        const registryUrl = `https://${host}`;
        this.#tokens.set(registryUrl, token.trim());
        continue;
      }

      // Also support format without protocol
      // Format: //registry.npmjs.org:_authToken=TOKEN
      const altTokenMatch = trimmed.match(/^\/\/([^:]+):_authToken=(.+)$/);
      if (altTokenMatch) {
        const [, host, token] = altTokenMatch;
        const registryUrl = `https://${host}`;
        this.#tokens.set(registryUrl, token.trim());
      }
    }
  }

  /**
   * Get auth token for a registry URL
   * @param {string} registryUrl - Registry URL
   * @returns {string|undefined} Auth token if found
   */
  getToken(registryUrl) {
    // Normalize URL by removing trailing slash
    const normalized = registryUrl.replace(/\/$/, '');

    // Try exact match first
    if (this.#tokens.has(normalized)) {
      return this.#tokens.get(normalized);
    }

    // Try with https:// prefix if not present
    if (!normalized.startsWith('http')) {
      const withProtocol = `https://${normalized}`;
      if (this.#tokens.has(withProtocol)) {
        return this.#tokens.get(withProtocol);
      }
    }

    // Try to match by hostname
    try {
      const url = new URL(normalized);
      const hostKey = `https://${url.hostname}`;
      if (this.#tokens.has(hostKey)) {
        return this.#tokens.get(hostKey);
      }

      // Also try with port if present
      if (url.port) {
        const hostPortKey = `https://${url.hostname}:${url.port}`;
        if (this.#tokens.has(hostPortKey)) {
          return this.#tokens.get(hostPortKey);
        }
      }
    } catch {
      // Invalid URL, ignore
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
    return this.#tokens.size > 0;
  }
}