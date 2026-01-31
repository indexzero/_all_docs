import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

/**
 * Generate a short hash for checkpoint filename
 * @param {string} inputPath - Absolute path to input file
 * @returns {string} 8-character hash
 */
function hashPath(inputPath) {
  return createHash('sha256').update(inputPath).digest('hex').slice(0, 8);
}

/**
 * Get the checkpoints directory path
 * @returns {string} Path to checkpoints directory
 */
function getCheckpointsDir() {
  const cacheDir = process.env.XDG_CACHE_HOME || join(homedir(), '.cache');
  return join(cacheDir, '_all_docs', 'checkpoints');
}

/**
 * Checkpoint system for tracking packument fetch-list progress
 * Enables resumable operations across interruptions
 */
export class PackumentListCheckpoint {
  /**
   * @param {string} inputFile - Path to the input file (JSON or text)
   */
  constructor(inputFile) {
    this.inputFile = resolve(inputFile);
    this.checkpointsDir = getCheckpointsDir();
    this.checkpointPath = join(this.checkpointsDir, `${hashPath(this.inputFile)}.checkpoint.json`);
    this.checkpoint = null;
    this.dirty = false;
  }

  /**
   * Initialize a new checkpoint from a list of package names
   * @param {string[]} packages - Array of package names
   * @returns {Object} The initialized checkpoint
   */
  initialize(packages) {
    mkdirSync(this.checkpointsDir, { recursive: true });

    const inputContent = readFileSync(this.inputFile, 'utf-8');
    const inputHash = createHash('sha256').update(inputContent).digest('hex');

    this.checkpoint = {
      version: 1,
      inputFile: this.inputFile,
      inputHash,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      total: packages.length,
      packages: {}
    };

    for (const name of packages) {
      this.checkpoint.packages[name] = {
        status: 'pending',
        attempts: 0,
        lastAttempt: null,
        completedAt: null,
        cached: false,
        error: null
      };
    }

    this.save();
    return this.checkpoint;
  }

  /**
   * Load an existing checkpoint from disk
   * @returns {Object|null} The loaded checkpoint or null if not found
   */
  load() {
    if (!existsSync(this.checkpointPath)) {
      return null;
    }

    const content = readFileSync(this.checkpointPath, 'utf-8');
    this.checkpoint = JSON.parse(content);
    return this.checkpoint;
  }

  /**
   * Check if checkpoint exists for this input file
   * @returns {boolean}
   */
  exists() {
    return existsSync(this.checkpointPath);
  }

  /**
   * Delete existing checkpoint
   */
  delete() {
    if (existsSync(this.checkpointPath)) {
      unlinkSync(this.checkpointPath);
    }
    this.checkpoint = null;
  }

  /**
   * Verify the input file hasn't changed since checkpoint was created
   * @returns {boolean} True if input file matches checkpoint
   */
  verifyInputHash() {
    if (!this.checkpoint) return false;

    const inputContent = readFileSync(this.inputFile, 'utf-8');
    const currentHash = createHash('sha256').update(inputContent).digest('hex');

    return currentHash === this.checkpoint.inputHash;
  }

  /**
   * Save checkpoint to disk
   */
  save() {
    if (!this.checkpoint) return;

    mkdirSync(this.checkpointsDir, { recursive: true });
    this.checkpoint.updatedAt = Date.now();
    writeFileSync(this.checkpointPath, JSON.stringify(this.checkpoint, null, 2));
    this.dirty = false;
  }

  /**
   * Mark a package as completed
   * @param {string} name - Package name
   * @param {boolean} cached - Whether it was a cache hit
   */
  markCompleted(name, cached = false) {
    if (!this.checkpoint?.packages[name]) return;

    this.checkpoint.packages[name] = {
      ...this.checkpoint.packages[name],
      status: 'completed',
      completedAt: Date.now(),
      cached,
      error: null
    };
    this.dirty = true;
  }

  /**
   * Mark a package as failed
   * @param {string} name - Package name
   * @param {string} error - Error message
   */
  markFailed(name, error) {
    if (!this.checkpoint?.packages[name]) return;

    const pkg = this.checkpoint.packages[name];
    this.checkpoint.packages[name] = {
      ...pkg,
      status: 'failed',
      attempts: pkg.attempts + 1,
      lastAttempt: Date.now(),
      error
    };
    this.dirty = true;
  }

  /**
   * Mark a package as in progress
   * @param {string} name - Package name
   */
  markInProgress(name) {
    if (!this.checkpoint?.packages[name]) return;

    const pkg = this.checkpoint.packages[name];
    this.checkpoint.packages[name] = {
      ...pkg,
      status: 'inProgress',
      lastAttempt: Date.now(),
      attempts: pkg.attempts + 1
    };
    this.dirty = true;
  }

  /**
   * Get list of pending packages (not completed, or failed with < 3 attempts)
   * @returns {string[]} Array of package names to process
   */
  getPending() {
    if (!this.checkpoint) return [];

    return Object.entries(this.checkpoint.packages)
      .filter(([, pkg]) => {
        if (pkg.status === 'pending') return true;
        if (pkg.status === 'failed' && pkg.attempts < 3) return true;
        return false;
      })
      .map(([name]) => name);
  }

  /**
   * Get list of failed packages
   * @returns {Array<{name: string, error: string, attempts: number}>}
   */
  getFailed() {
    if (!this.checkpoint) return [];

    return Object.entries(this.checkpoint.packages)
      .filter(([, pkg]) => pkg.status === 'failed')
      .map(([name, pkg]) => ({
        name,
        error: pkg.error,
        attempts: pkg.attempts
      }));
  }

  /**
   * Get checkpoint status summary
   * @returns {Object} Status summary
   */
  getStatus() {
    if (!this.checkpoint) {
      return null;
    }

    const stats = {
      total: this.checkpoint.total,
      completed: 0,
      cached: 0,
      fetched: 0,
      pending: 0,
      failed: 0,
      inProgress: 0
    };

    for (const pkg of Object.values(this.checkpoint.packages)) {
      if (pkg.status === 'completed') {
        stats.completed++;
        if (pkg.cached) {
          stats.cached++;
        } else {
          stats.fetched++;
        }
      } else if (pkg.status === 'pending') {
        stats.pending++;
      } else if (pkg.status === 'failed') {
        stats.failed++;
      } else if (pkg.status === 'inProgress') {
        stats.inProgress++;
      }
    }

    return {
      checkpointPath: this.checkpointPath,
      inputFile: this.checkpoint.inputFile,
      inputHashMatch: this.verifyInputHash(),
      createdAt: new Date(this.checkpoint.createdAt).toISOString(),
      updatedAt: new Date(this.checkpoint.updatedAt).toISOString(),
      stats,
      percentComplete: ((stats.completed / stats.total) * 100).toFixed(1)
    };
  }

  /**
   * Save checkpoint if dirty (for periodic saves during long runs)
   */
  saveIfDirty() {
    if (this.dirty) {
      this.save();
    }
  }
}
