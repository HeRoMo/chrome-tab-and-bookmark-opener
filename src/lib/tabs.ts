import type { UnifiedItem } from '../types/item.js';

/**
 * Reads all open tabs across all Chrome windows via JXA's Chrome dictionary.
 * Not cached: this must always reflect live state, and it's cheap relative
 * to bookmark file parsing.
 */
export function getOpenTabs(): UnifiedItem[] {
  const chrome = Application('Google Chrome');
  const items: UnifiedItem[] = [];

  if (!chrome.running()) {
    return items;
  }

  // Use JXA specifier-based bulk property access: one Apple Event per window
  // instead of two per tab (title + url individually).
  const numWindows: number = chrome.windows.length;
  for (let wIdx = 0; wIdx < numWindows; wIdx++) {
    try {
      // Bulk-fetching `.title()`/`.url()` on a window with zero tabs (seen
      // in the wild on some setups — e.g. a transient/closing window) makes
      // Chrome's Apple Events bridge return NSNull instead of `[]`, which
      // crashes the whole script (`-[NSNull count]`) once we touch
      // `.length` on it. Checking the count first via `.tabs.length` (a
      // plain scalar query, unaffected by this) lets us skip those safely.
      const numTabs: number = chrome.windows[wIdx].tabs.length;
      if (numTabs === 0) continue;

      const titles: string[] = chrome.windows[wIdx].tabs.title();
      const urls: string[] = chrome.windows[wIdx].tabs.url();
      for (let tIdx = 0; tIdx < titles.length; tIdx++) {
        items.push({
          type: 'tab',
          title: titles[tIdx],
          url: urls[tIdx],
          windowIndex: wIdx,
          tabIndex: tIdx,
        });
      }
    } catch {
      // A single problematic window (e.g. one that closed mid-enumeration)
      // shouldn't take down the whole search.
      continue;
    }
  }

  return items;
}
