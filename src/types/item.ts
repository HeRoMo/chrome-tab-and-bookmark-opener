export type UnifiedItem = {
  type: 'tab' | 'bookmark';
  title: string;
  url: string;
  /** Present only for type === 'tab'. 0-indexed. */
  windowIndex?: number;
  /** Present only for type === 'tab'. 0-indexed. */
  tabIndex?: number;
};

export type CacheEntry<T> = {
  data: T;
  fetchedAt: number; // epoch ms
};
