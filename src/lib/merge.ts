import type { UnifiedItem } from '../types/item.js';

/**
 * Merges tabs and bookmarks, preferring the open tab when the same URL
 * exists in both — opening a bookmark that's already open as a tab would
 * create a duplicate tab, which is rarely what the user wants.
 */
export function mergeItems(tabs: UnifiedItem[], bookmarks: UnifiedItem[]): UnifiedItem[] {
  const tabUrls = new Set(tabs.map((t) => t.url));
  const dedupedBookmarks = bookmarks.filter((b) => !tabUrls.has(b.url));
  return [...tabs, ...dedupedBookmarks];
}

export function filterByQuery(items: UnifiedItem[], query: string): UnifiedItem[] {
  const q = query.toLowerCase().trim();
  if (!q) return items;
  return items.filter(
    (item) => item.title.toLowerCase().includes(q) || item.url.toLowerCase().includes(q)
  );
}

/**
 * Full tab/bookmark search for a query.
 *
 * Tabs and bookmarks are filtered *independently* before merging: a query
 * that only matches a bookmark's saved title (not the live tab title of
 * an already-open copy of that URL, nor the URL itself) must still
 * surface the bookmark — deduping against the *full* tab list first would
 * silently return nothing in that case (see HANDOFF.md).
 *
 * For any bookmark that survives merging (i.e. no *directly* query-matching
 * tab already covers its URL), its open tab — if one exists — is inserted
 * right before it. This lets the user choose to focus the existing tab
 * instead of opening a duplicate, without hiding the bookmark match itself.
 */
export function searchItems(
  tabs: UnifiedItem[],
  bookmarks: UnifiedItem[],
  query: string
): UnifiedItem[] {
  const filteredTabs = filterByQuery(tabs, query);
  const filteredTabUrls = new Set(filteredTabs.map((t) => t.url));
  const filteredBookmarks = filterByQuery(bookmarks, query);

  const merged = mergeItems(filteredTabs, filteredBookmarks);

  const result: UnifiedItem[] = [];
  for (const item of merged) {
    if (item.type === 'bookmark') {
      const relatedTab = tabs.find((t) => t.url === item.url && !filteredTabUrls.has(t.url));
      if (relatedTab) result.push(relatedTab);
    }
    result.push(item);
  }
  return result;
}
