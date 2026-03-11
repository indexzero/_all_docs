import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { join } from 'node:path';
import { defaultCacheDir } from '../default-cache-dir.js';

describe('defaultCacheDir', () => {
  it('should return macOS path for darwin platform', () => {
    const result = defaultCacheDir({ HOME: '/Users/alice' }, 'darwin');
    assert.equal(result, join('/Users/alice', 'Library', 'Caches', '_all_docs'));
  });

  it('should return Linux XDG path with default HOME', () => {
    const result = defaultCacheDir({ HOME: '/home/alice' }, 'linux');
    assert.equal(result, join('/home/alice', '.cache', '_all_docs'));
  });

  it('should respect XDG_CACHE_HOME on Linux', () => {
    const result = defaultCacheDir(
      { HOME: '/home/alice', XDG_CACHE_HOME: '/custom/cache' },
      'linux'
    );
    assert.equal(result, join('/custom/cache', '_all_docs'));
  });

  it('should respect ALLDOCS_CACHE_DIR override on any platform', () => {
    const override = '/my/custom/cache';
    assert.equal(defaultCacheDir({ ALLDOCS_CACHE_DIR: override, HOME: '/Users/alice' }, 'darwin'), override);
    assert.equal(defaultCacheDir({ ALLDOCS_CACHE_DIR: override, HOME: '/home/alice' }, 'linux'), override);
  });

  it('should throw when HOME and USERPROFILE are both unset', () => {
    assert.throws(
      () => defaultCacheDir({}, 'linux'),
      /Cannot determine home directory/
    );
  });

  it('should return Windows path for win32 platform', () => {
    const result = defaultCacheDir(
      { USERPROFILE: 'C:\\Users\\alice', LOCALAPPDATA: 'C:\\Users\\alice\\AppData\\Local' },
      'win32'
    );
    assert.equal(result, join('C:\\Users\\alice\\AppData\\Local', '_all_docs', 'cache'));
  });

  it('should fall back to USERPROFILE on win32 without LOCALAPPDATA', () => {
    const result = defaultCacheDir({ USERPROFILE: 'C:\\Users\\alice' }, 'win32');
    assert.equal(result, join('C:\\Users\\alice', 'AppData', 'Local', '_all_docs', 'cache'));
  });
});
