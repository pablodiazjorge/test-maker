const THREE_DAYS_IN_MS = 3 * 24 * 60 * 60 * 1000;

// Every key this cache has used starts with this prefix. Theme and language preferences use
// `test-maker-` (with a hyphen) and stay in localStorage.
const CACHE_KEY_PREFIX = 'test-maker.';

interface ExpiringCacheEntry<T> {
  value: T;
  expiresAt: number;
}

// The cache holds the auth session and the decrypted question bank, so it lives in sessionStorage:
// it is per tab and the browser drops it when the tab is closed. The TTL caps long-lived tabs.
function getSessionStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' && window.sessionStorage ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

export function writeCacheValue<T>(key: string, value: T, ttlMs = THREE_DAYS_IN_MS): void {
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }

  try {
    const payload: ExpiringCacheEntry<T> = {
      value,
      expiresAt: Date.now() + ttlMs,
    };
    storage.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignore storage failures and keep app behavior working without cache.
  }
}

export function readCacheValue<T>(key: string): T | null {
  const storage = getSessionStorage();
  if (!storage) {
    return null;
  }

  try {
    const rawValue = storage.getItem(key);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as ExpiringCacheEntry<T>;
    if (!parsed || typeof parsed.expiresAt !== 'number') {
      storage.removeItem(key);
      return null;
    }

    if (Date.now() > parsed.expiresAt) {
      storage.removeItem(key);
      return null;
    }

    return parsed.value ?? null;
  } catch {
    storage.removeItem(key);
    return null;
  }
}

export function clearCacheValue(key: string): void {
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage failures and keep app behavior working without cache.
  }
}

// Earlier versions kept this cache, decrypted bank included, in localStorage for 3 days.
// Called once at startup to remove what they left behind.
export function purgeLegacyLocalCache(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    const storage = window.localStorage;
    const legacyKeys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(CACHE_KEY_PREFIX)) {
        legacyKeys.push(key);
      }
    }
    legacyKeys.forEach((key) => storage.removeItem(key));
  } catch {
    // Ignore storage failures: there is nothing to purge if localStorage is unavailable.
  }
}

export { THREE_DAYS_IN_MS };
