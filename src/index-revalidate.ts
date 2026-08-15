import { getBookmarks } from './lib/bookmarks.js';
import { writeCacheFile } from './lib/cache.js';
import { getEnvVar } from './lib/shell.js';

export function run(argv: string[]): void {
  const key = argv[0];
  if (key !== 'bookmarks') return;

  const profileDirName = getEnvVar('chrome_profile') || 'Default';
  const bookmarks = getBookmarks(profileDirName);
  writeCacheFile('bookmarks', { data: bookmarks, fetchedAt: Date.now() });
}
