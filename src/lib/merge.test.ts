import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchItems, mergeItems, filterByQuery } from './merge.js';
import type { UnifiedItem } from '../types/item.js';

function tab(title: string, url: string): UnifiedItem {
  return { type: 'tab', title, url };
}

function bookmark(title: string, url: string): UnifiedItem {
  return { type: 'bookmark', title, url };
}

test('filterByQuery: empty query returns all items unchanged', () => {
  const items = [tab('A', 'https://a.example')];
  assert.deepEqual(filterByQuery(items, ''), items);
});

test('filterByQuery: matches by title or url, case-insensitively', () => {
  const items = [tab('GitHub', 'https://github.com'), tab('Example', 'https://example.com')];
  assert.deepEqual(filterByQuery(items, 'GIT'), [items[0]]);
  assert.deepEqual(filterByQuery(items, 'example.com'), [items[1]]);
});

test('mergeItems: dedupes a bookmark whose URL is already an open tab', () => {
  const tabs = [tab('GitHub', 'https://github.com')];
  const bookmarks = [bookmark('GitHub bookmark', 'https://github.com')];
  assert.deepEqual(mergeItems(tabs, bookmarks), tabs);
});

test('mergeItems: keeps bookmarks whose URL has no open tab', () => {
  const tabs: UnifiedItem[] = [];
  const bookmarks = [bookmark('GitHub bookmark', 'https://github.com')];
  assert.deepEqual(mergeItems(tabs, bookmarks), bookmarks);
});

test(
  'searchItems: a bookmark-title-only match still surfaces the bookmark ' +
    'even when a same-URL tab exists with a non-matching title ' +
    '(regression: "gas" bookmark for script.google.com hidden by a tab titled "Apps Script")',
  () => {
    const tabs = [tab('Apps Script', 'https://script.google.com/home')];
    const bookmarks = [bookmark('gas', 'https://script.google.com/home')];

    const result = searchItems(tabs, bookmarks, 'gas');

    // Both the open tab and the bookmark are shown, so the user can choose
    // to focus the existing tab instead of opening a duplicate.
    assert.deepEqual(result, [tabs[0], bookmarks[0]]);
  }
);

test(
  'searchItems: a Japanese-page bookmark whose romaji name matches neither ' +
    'the live tab title nor the URL still surfaces both ("kintai")',
  () => {
    const tabs = [tab('勤怠管理システム - 打刻確認', 'https://attendance.example.co.jp/dashboard')];
    const bookmarks = [bookmark('kintai', 'https://attendance.example.co.jp/dashboard')];

    const result = searchItems(tabs, bookmarks, 'kintai');

    assert.deepEqual(result, [tabs[0], bookmarks[0]]);
  }
);

test('searchItems: when both the tab and bookmark match the query directly, the bookmark is deduped (tab wins)', () => {
  const tabs = [tab('Apps Script', 'https://script.google.com/home')];
  const bookmarks = [bookmark('Apps Script Bookmark', 'https://script.google.com/home')];

  const result = searchItems(tabs, bookmarks, 'script');

  assert.deepEqual(result, [tabs[0]]);
});

test('searchItems: a bookmark match with no open tab at all returns just the bookmark', () => {
  const bookmarks = [bookmark('gas', 'https://script.google.com/home')];

  const result = searchItems([], bookmarks, 'gas');

  assert.deepEqual(result, bookmarks);
});

test('searchItems: an unrelated open tab does not leak into a bookmark-only match', () => {
  const tabs = [tab('GitHub', 'https://github.com')];
  const bookmarks = [bookmark('gas', 'https://script.google.com/home')];

  const result = searchItems(tabs, bookmarks, 'gas');

  assert.deepEqual(result, bookmarks);
});
