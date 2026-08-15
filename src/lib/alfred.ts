import type { UnifiedItem } from '../types/item.js';

type AlfredScriptFilterItem = {
  title: string;
  subtitle: string;
  arg: string;
  icon: { path: string };
  variables: {
    itemType: 'tab' | 'bookmark';
    windowIndex: string;
    tabIndex: string;
  };
};

export function toAlfredItem(item: UnifiedItem): AlfredScriptFilterItem {
  return {
    title: item.title || item.url,
    subtitle: item.url,
    arg: item.url,
    icon: { path: item.type === 'tab' ? 'icons/tab.png' : 'icons/bookmark.png' },
    variables: {
      itemType: item.type,
      windowIndex: item.windowIndex !== undefined ? String(item.windowIndex) : '',
      tabIndex: item.tabIndex !== undefined ? String(item.tabIndex) : '',
    },
  };
}

export function toScriptFilterJson(items: UnifiedItem[]): string {
  if (items.length === 0) {
    return JSON.stringify({
      items: [
        {
          title: 'No matching tabs or bookmarks',
          subtitle: 'Try a different search term',
          valid: false,
        },
      ],
    });
  }
  return JSON.stringify({ items: items.map(toAlfredItem) });
}
