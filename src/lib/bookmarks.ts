import type { UnifiedItem } from '../types/item.js';
import { shell, homeDir } from './shell.js';

type ChromeBookmarkNode = {
  type: 'url' | 'folder';
  name: string;
  url?: string;
  children?: ChromeBookmarkNode[];
};

type ChromeBookmarksFile = {
  roots: Record<string, ChromeBookmarkNode>;
};

/**
 * Default Chrome profile directory. Override via the workflow's
 * `chrome_profile` configuration variable (see README) if you use a
 * non-default profile (e.g. "Profile 1").
 */
export function getProfilePath(profileDirName = 'Default'): string {
  return `${homeDir()}/Library/Application Support/Google/Chrome/${profileDirName}`;
}

export function getBookmarksFilePath(profileDirName = 'Default'): string {
  return `${getProfilePath(profileDirName)}/Bookmarks`;
}

export function getBookmarks(profileDirName = 'Default'): UnifiedItem[] {
  const path = getBookmarksFilePath(profileDirName);
  const raw = shell(`cat "${path}" 2>/dev/null`);
  if (!raw) return [];

  let json: ChromeBookmarksFile;
  try {
    json = JSON.parse(raw);
  } catch {
    return [];
  }

  const items: UnifiedItem[] = [];

  function walk(node: ChromeBookmarkNode): void {
    if (node.type === 'url' && node.url) {
      items.push({ type: 'bookmark', title: node.name, url: node.url });
    } else if (node.children) {
      node.children.forEach(walk);
    }
  }

  Object.values(json.roots).forEach(walk);
  return items;
}
