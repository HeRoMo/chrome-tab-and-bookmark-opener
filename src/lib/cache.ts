import type { CacheEntry } from '../types/item.js';
import { shell, shellQuote, homeDir } from './shell.js';

const TTL_MS = 15 * 60 * 1000; // 15 minutes — see README for rationale

function cacheDir(): string {
  return `${homeDir()}/Library/Caches/com.alfred.chrome-tab-and-bookmark-opener`;
}

/**
 * Cache keys become filenames (`<key>.json`), so beyond shell-quoting the
 * resulting path, restrict the key itself to a strict allowlist — this is
 * defense in depth against a key ever containing a path separator or
 * shell metacharacter (today every call site passes a literal like
 * `'bookmarks'`; a future multi-profile cache key derived from the
 * user-configured `chrome_profile` variable should still be safe).
 */
function assertValidCacheKey(key: string): void {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(key)) {
    throw new Error(`Invalid cache key: ${key}`);
  }
}

function readCacheFile<T>(key: string): CacheEntry<T> | null {
  try {
    assertValidCacheKey(key);
    const path = `${cacheDir()}/${key}.json`;
    const raw = shell(`cat ${shellQuote(path)} 2>/dev/null`);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry<T>;
  } catch {
    // Missing file or corrupt JSON: treat as cache miss.
    return null;
  }
}

/**
 * Writes via a temp file + atomic `mv` so a concurrent reader (another
 * Alfred keystroke triggering a read while a background revalidate is
 * writing) never sees a half-written file.
 *
 * A prior version of this used the ObjC bridge (`$.NSFileManager`,
 * `$.NSString...writeToFile...`) for the perceived subprocess-launch
 * savings, but that bridge turned out to behave inconsistently across
 * macOS versions — a `NSError**` out-param handled fine on one machine
 * crashed with `-[NSNull count]: unrecognized selector` on another, and
 * fixing that only surfaced a *different* failure elsewhere (a selector
 * reported as "not a function") on a third. Shelling out is slower per
 * call but has none of that version-dependent bridge behavior, so
 * correctness wins here. See HANDOFF.md for the full incident.
 */
export function writeCacheFile<T>(key: string, entry: CacheEntry<T>): void {
  assertValidCacheKey(key);
  const dir = cacheDir();
  shell(`mkdir -p ${shellQuote(dir)}`);
  const tmpPath = `${dir}/${key}.json.tmp`;
  const finalPath = `${dir}/${key}.json`;
  const json = JSON.stringify(entry);
  // The heredoc body itself doesn't need shellQuote: a single-quoted
  // delimiter (`'ALFRED_CACHE_EOF'`) already disables all shell expansion
  // ($…, `…`, \…) inside the body, and JSON.stringify's output is always
  // a single line so it can't collide with the bare terminator line.
  shell(`cat > ${shellQuote(tmpPath)} << 'ALFRED_CACHE_EOF'\n${json}\nALFRED_CACHE_EOF`);
  shell(`mv ${shellQuote(tmpPath)} ${shellQuote(finalPath)}`);
}

function fileMtimeMs(filePath: string): number {
  const epoch = shell(`stat -f %m ${shellQuote(filePath)} 2>/dev/null || echo 0`);
  return Number(epoch) * 1000;
}

function triggerRevalidateInBackground(key: string, revalidateScriptPath: string): void {
  assertValidCacheKey(key);
  // nohup + `&` detaches the process so this Script Filter invocation
  // returns immediately without waiting for revalidation to finish.
  shell(
    `nohup /usr/bin/osascript -l JavaScript ${shellQuote(revalidateScriptPath)} ${shellQuote(key)} > /dev/null 2>&1 &`
  );
}

export type SwrOptions = {
  key: string;
  /** File whose mtime invalidates the cache immediately, bypassing TTL. */
  watchFilePath: string;
  revalidateScriptPath: string;
  ttlMs?: number;
};

export type SwrResult<T> = {
  data: T | null;
  isStale: boolean;
};

/**
 * Stale-while-revalidate read.
 *
 * - Cache miss (first run ever): returns { data: null }, caller must do a
 *   synchronous fetch once and prime the cache.
 * - Cache hit: returns cached data immediately. If TTL has expired OR the
 *   watched file's mtime is newer than the cache, a background revalidate
 *   process is kicked off (fire-and-forget) so the *next* invocation sees
 *   fresh data.
 */
export function swr<T>(opts: SwrOptions): SwrResult<T> {
  const { key, watchFilePath, revalidateScriptPath, ttlMs = TTL_MS } = opts;
  const cached = readCacheFile<T>(key);

  if (!cached) {
    return { data: null, isStale: true };
  }

  const now = Date.now();
  const ttlExpired = now - cached.fetchedAt > ttlMs;
  const fileChanged = fileMtimeMs(watchFilePath) > cached.fetchedAt;
  const isStale = ttlExpired || fileChanged;

  if (isStale) {
    triggerRevalidateInBackground(key, revalidateScriptPath);
  }

  return { data: cached.data, isStale };
}