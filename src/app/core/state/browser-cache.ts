const THREE_DAYS_IN_MS = 3 * 24 * 60 * 60 * 1000;

interface ExpiringCacheEntry<T> {
  value: T;
  expiresAt: number;
}

function hasLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function writeCacheValue<T>(key: string, value: T, ttlMs = THREE_DAYS_IN_MS): void {
  if (!hasLocalStorage()) {
    return;
  }

  try {
    const payload: ExpiringCacheEntry<T> = {
      value,
      expiresAt: Date.now() + ttlMs,
    };
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignore storage failures and keep app behavior working without cache.
  }
}

export function readCacheValue<T>(key: string): T | null {
  if (!hasLocalStorage()) {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(key);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as ExpiringCacheEntry<T>;
    if (!parsed || typeof parsed.expiresAt !== 'number') {
      window.localStorage.removeItem(key);
      return null;
    }

    if (Date.now() > parsed.expiresAt) {
      window.localStorage.removeItem(key);
      return null;
    }

    return parsed.value ?? null;
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
}

export function clearCacheValue(key: string): void {
  if (!hasLocalStorage()) {
    return;
  }

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures and keep app behavior working without cache.
  }
}

export { THREE_DAYS_IN_MS };
