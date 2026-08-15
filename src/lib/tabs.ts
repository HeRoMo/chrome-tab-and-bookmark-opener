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

  const windows = chrome.windows();
  for (let wIdx = 0; wIdx < windows.length; wIdx++) {
    const tabs = windows[wIdx].tabs();
    for (let tIdx = 0; tIdx < tabs.length; tIdx++) {
      items.push({
        type: 'tab',
        title: tabs[tIdx].title(),
        url: tabs[tIdx].url(),
        windowIndex: wIdx,
        tabIndex: tIdx,
      });
    }
  }

  return items;
}
