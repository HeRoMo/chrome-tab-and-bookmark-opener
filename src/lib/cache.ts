import type { CacheEntry } from '../types/item.js';
import { shell, homeDir } from './shell.js';

const TTL_MS = 15 * 60 * 1000; // 15 minutes — see README for rationale

function cacheDir(): string {
  return `${homeDir()}/Library/Caches/com.alfred.chrome-tab-and-bookmark-opener`;
}

function readCacheFile<T>(key: string): CacheEntry<T> | null {
  try {
    const raw = shell(`cat "${cacheDir()}/${key}.json" 2>/dev/null`);
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
 */
export function writeCacheFile<T>(key: string, entry: CacheEntry<T>): void {
  const dir = cacheDir();
  shell(`mkdir -p "${dir}"`);
  const tmpPath = `${dir}/${key}.json.tmp`;
  const finalPath = `${dir}/${key}.json`;
  const json = JSON.stringify(entry);
  shell(`cat > "${tmpPath}" << 'ALFRED_CACHE_EOF'\n${json}\nALFRED_CACHE_EOF`);
  shell(`mv "${tmpPath}" "${finalPath}"`);
}

function fileMtimeMs(filePath: string): number {
  const epoch = shell(`stat -f %m "${filePath}" 2>/dev/null || echo 0`);
  return Number(epoch) * 1000;
}

function triggerRevalidateInBackground(key: string, revalidateScriptPath: string): void {
  // nohup + `&` detaches the process so this Script Filter invocation
  // returns immediately without waiting for revalidation to finish.
  shell(
    `nohup /usr/bin/osascript -l JavaScript "${revalidateScriptPath}" "${key}" > /dev/null 2>&1 &`
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
