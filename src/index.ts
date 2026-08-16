import { getOpenTabs } from './lib/tabs.js';
import { getBookmarks, getBookmarksFilePath } from './lib/bookmarks.js';
import { searchItems } from './lib/merge.js';
import { swr, writeCacheFile } from './lib/cache.js';
import { toScriptFilterJson } from './lib/alfred.js';
import { getEnvVar, getWorkflowPath } from './lib/shell.js';
import type { UnifiedItem } from './types/item.js';

export function run(argv: string[]): string {
  const query = argv[0] || '';
  const profileDirName = getEnvVar('chrome_profile') || 'Default';

  const tabs = getOpenTabs();

  const { data: cachedBookmarks } = swr<UnifiedItem[]>({
    key: 'bookmarks',
    watchFilePath: getBookmarksFilePath(profileDirName),
    revalidateScriptPath: `${getWorkflowPath()}/revalidate.js`,
  });

  // Only happens on the very first invocation ever (no cache file yet):
  // fetch synchronously once and prime the cache for all future calls.
  let bookmarks = cachedBookmarks;
  if (bookmarks === null) {
    bookmarks = getBookmarks(profileDirName);
    writeCacheFile('bookmarks', { data: bookmarks, fetchedAt: Date.now() });
  }

  const results = searchItems(tabs, bookmarks, query);

  return toScriptFilterJson(results);
}
