import type { CacheEntry } from '../types/item.js';
import { shell, homeDir } from './shell.js';

const TTL_MS = 15 * 60 * 1000; // 15 minutes — see README for rationale

function cacheDir(): string {
  return `${homeDir()}/Library/Caches/com.alfred.chrome-tab-and-bookmark-opener`;
}

function readCacheFile<T>(key: string): CacheEntry<T> | null {
  try {
    ObjC.import('Foundation');
    const path = `${cacheDir()}/${key}.json`;
    const data = $.NSData.dataWithContentsOfFile($(path));
    if (!data || !data.length) return null;
    const str = $.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding);
    const raw: string = str.js;
    return JSON.parse(raw) as CacheEntry<T>;
  } catch {
    return null;
  }
}

/**
 * Writes via NSString's built-in atomic write (temp file + rename internally),
 * replacing the manual shell cat+mv approach.
 */
export function writeCacheFile<T>(key: string, entry: CacheEntry<T>): void {
  ObjC.import('Foundation');
  const dir = cacheDir();
  $.NSFileManager.defaultManager.createDirectoryAtPathWithIntermediateDirectoriesAttributesError(
    $(dir), true, null, null
  );
  const path = `${dir}/${key}.json`;
  const json = JSON.stringify(entry);
  const nsStr = $.NSString.alloc.initWithUTF8String(json);
  nsStr.writeToFile_atomically_encoding_error_($(path), true, $.NSUTF8StringEncoding, null);
}

function fileMtimeMs(filePath: string): number {
  try {
    ObjC.import('Foundation');
    const attrs = $.NSFileManager.defaultManager.attributesOfItemAtPathError($(filePath), null);
    const date = attrs.objectForKey('NSFileModificationDate');
    return date.timeIntervalSince1970 * 1000;
  } catch {
    return 0;
  }
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