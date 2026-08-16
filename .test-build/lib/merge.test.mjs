// src/lib/merge.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

// src/lib/merge.ts
function mergeItems(tabs, bookmarks) {
  const tabUrls = new Set(tabs.map((t) => t.url));
  const dedupedBookmarks = bookmarks.filter((b) => !tabUrls.has(b.url));
  return [...tabs, ...dedupedBookmarks];
}
function filterByQuery(items, query) {
  const q = query.toLowerCase().trim();
  if (!q) return items;
  return items.filter(
    (item) => item.title.toLowerCase().includes(q) || item.url.toLowerCase().includes(q)
  );
}
function searchItems(tabs, bookmarks, query) {
  const filteredTabs = filterByQuery(tabs, query);
  const filteredTabUrls = new Set(filteredTabs.map((t) => t.url));
  const filteredBookmarks = filterByQuery(bookmarks, query);
  const merged = mergeItems(filteredTabs, filteredBookmarks);
  const result = [];
  for (const item of merged) {
    if (item.type === "bookmark") {
      const relatedTab = tabs.find((t) => t.url === item.url && !filteredTabUrls.has(t.url));
      if (relatedTab) result.push(relatedTab);
    }
    result.push(item);
  }
  return result;
}

// src/lib/merge.test.ts
function tab(title, url) {
  return { type: "tab", title, url };
}
function bookmark(title, url) {
  return { type: "bookmark", title, url };
}
test("filterByQuery: empty query returns all items unchanged", () => {
  const items = [tab("A", "https://a.example")];
  assert.deepEqual(filterByQuery(items, ""), items);
});
test("filterByQuery: matches by title or url, case-insensitively", () => {
  const items = [tab("GitHub", "https://github.com"), tab("Example", "https://example.com")];
  assert.deepEqual(filterByQuery(items, "GIT"), [items[0]]);
  assert.deepEqual(filterByQuery(items, "example.com"), [items[1]]);
});
test("mergeItems: dedupes a bookmark whose URL is already an open tab", () => {
  const tabs = [tab("GitHub", "https://github.com")];
  const bookmarks = [bookmark("GitHub bookmark", "https://github.com")];
  assert.deepEqual(mergeItems(tabs, bookmarks), tabs);
});
test("mergeItems: keeps bookmarks whose URL has no open tab", () => {
  const tabs = [];
  const bookmarks = [bookmark("GitHub bookmark", "https://github.com")];
  assert.deepEqual(mergeItems(tabs, bookmarks), bookmarks);
});
test(
  'searchItems: a bookmark-title-only match still surfaces the bookmark even when a same-URL tab exists with a non-matching title (regression: "gas" bookmark for script.google.com hidden by a tab titled "Apps Script")',
  () => {
    const tabs = [tab("Apps Script", "https://script.google.com/home")];
    const bookmarks = [bookmark("gas", "https://script.google.com/home")];
    const result = searchItems(tabs, bookmarks, "gas");
    assert.deepEqual(result, [tabs[0], bookmarks[0]]);
  }
);
test(
  'searchItems: a Japanese-page bookmark whose romaji name matches neither the live tab title nor the URL still surfaces both ("kintai")',
  () => {
    const tabs = [tab("\u52E4\u6020\u7BA1\u7406\u30B7\u30B9\u30C6\u30E0 - \u6253\u523B\u78BA\u8A8D", "https://attendance.example.co.jp/dashboard")];
    const bookmarks = [bookmark("kintai", "https://attendance.example.co.jp/dashboard")];
    const result = searchItems(tabs, bookmarks, "kintai");
    assert.deepEqual(result, [tabs[0], bookmarks[0]]);
  }
);
test("searchItems: when both the tab and bookmark match the query directly, the bookmark is deduped (tab wins)", () => {
  const tabs = [tab("Apps Script", "https://script.google.com/home")];
  const bookmarks = [bookmark("Apps Script Bookmark", "https://script.google.com/home")];
  const result = searchItems(tabs, bookmarks, "script");
  assert.deepEqual(result, [tabs[0]]);
});
test("searchItems: a bookmark match with no open tab at all returns just the bookmark", () => {
  const bookmarks = [bookmark("gas", "https://script.google.com/home")];
  const result = searchItems([], bookmarks, "gas");
  assert.deepEqual(result, bookmarks);
});
test("searchItems: an unrelated open tab does not leak into a bookmark-only match", () => {
  const tabs = [tab("GitHub", "https://github.com")];
  const bookmarks = [bookmark("gas", "https://script.google.com/home")];
  const result = searchItems(tabs, bookmarks, "gas");
  assert.deepEqual(result, bookmarks);
});
