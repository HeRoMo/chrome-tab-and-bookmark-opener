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
  }

  return items;
}
