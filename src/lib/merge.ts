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
