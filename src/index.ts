import { getOpenTabs } from './lib/tabs.js';
import { getBookmarks, getBookmarksFilePath } from './lib/bookmarks.js';
import { mergeItems, filterByQuery } from './lib/merge.js';
import { swr, writeCacheFile } from './lib/cache.js';
import { toScriptFilterJson } from './lib/alfred.js';
import { getEnvVar, getWorkflowPath } from './lib/shell.js';
import type { UnifiedItem } from './types/item.js';

// TEMPORARY: pinpoints which step throws by prefixing the error message
// with a step label, since Alfred's debug console gives no stack trace for
// JXA runtime errors. Remove once the NSNull-count crash (see HANDOFF.md)
// is root-caused.
function step<T>(label: string, fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(`[step:${label}] ${message}`);
  }
}

export function run(argv: string[]): string {
  const query = argv[0] || '';
  const profileDirName = getEnvVar('chrome_profile') || 'Default';

  const tabs = step('getOpenTabs', () => getOpenTabs());

  const { data: cachedBookmarks } = step('swr', () =>
    swr<UnifiedItem[]>({
      key: 'bookmarks',
      watchFilePath: getBookmarksFilePath(profileDirName),
      revalidateScriptPath: `${getWorkflowPath()}/revalidate.js`,
    })
  );

  // Only happens on the very first invocation ever (no cache file yet):
  // fetch synchronously once and prime the cache for all future calls.
  let bookmarks = cachedBookmarks;
  if (bookmarks === null) {
    bookmarks = step('getBookmarks', () => getBookmarks(profileDirName));
    step('writeCacheFile', () =>
      writeCacheFile('bookmarks', { data: bookmarks, fetchedAt: Date.now() })
    );
  }

  const merged = step('mergeItems', () => mergeItems(tabs, bookmarks));
  const filtered = step('filterByQuery', () => filterByQuery(merged, query));

  return step('toScriptFilterJson', () => toScriptFilterJson(filtered));
}
