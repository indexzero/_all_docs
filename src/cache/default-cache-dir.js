import { join } from 'node:path';

/**
 * Resolve the default cache directory using platform-aware conventions.
 *
 * Precedence:
 *   1. ALLDOCS_CACHE_DIR env var
 *   2. Platform default:
 *      - macOS:  ~/Library/Caches/_all_docs
 *      - Linux:  ${XDG_CACHE_HOME:-$HOME/.cache}/_all_docs
 *      - Win32:  %LOCALAPPDATA%\_all_docs\cache
 *
 * @param {Object} [env=process.env] - Environment variables (for testability)
 * @param {string} [platform=process.platform] - OS platform (for testability)
 * @returns {string} Absolute path to cache directory
 */
export function defaultCacheDir(env = process.env, platform = process.platform) {
  if (env.ALLDOCS_CACHE_DIR) {
    return env.ALLDOCS_CACHE_DIR;
  }

  // On win32, prefer USERPROFILE (native Windows path) over HOME (may be MSYS2/Git Bash)
  const home = platform === 'win32'
    ? (env.USERPROFILE || env.HOME)
    : (env.HOME || env.USERPROFILE);
  if (!home) {
    throw new Error('Cannot determine home directory: neither HOME nor USERPROFILE is set');
  }

  switch (platform) {
    case 'darwin':
      return join(home, 'Library', 'Caches', '_all_docs');
    case 'win32':
      return join(env.LOCALAPPDATA || join(home, 'AppData', 'Local'), '_all_docs', 'cache');
    default:
      return join(env.XDG_CACHE_HOME || join(home, '.cache'), '_all_docs');
  }
}
