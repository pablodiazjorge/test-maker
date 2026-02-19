import { computed, inject, InjectionToken, Signal, signal } from '@angular/core';
import { clearCacheValue, readCacheValue, writeCacheValue } from './browser-cache';

export interface AuthSession {
  userId: string;
  authenticatedAt: number;
}

export interface AuthStore {
  readonly session: Signal<AuthSession | null>;
  readonly isAuthenticated: Signal<boolean>;
  readonly userId: Signal<string | null>;
  login: (userId: string) => void;
  logout: () => void;
}

const AUTH_CACHE_KEY = 'test-maker.auth.v1';

function createAuthStore(): AuthStore {
  const session = signal<AuthSession | null>(readAuthSessionFromCache());
  const isAuthenticated = computed(() => !!session());
  const userId = computed(() => session()?.userId ?? null);

  return {
    session: session.asReadonly(),
    isAuthenticated,
    userId,
    login: (nextUserId: string) => {
      const normalizedUserId = nextUserId.trim();
      const nextSession: AuthSession = {
        userId: normalizedUserId,
        authenticatedAt: Date.now(),
      };
      session.set(nextSession);
      writeCacheValue(AUTH_CACHE_KEY, nextSession);
    },
    logout: () => {
      session.set(null);
      clearCacheValue(AUTH_CACHE_KEY);
    },
  };
}

function readAuthSessionFromCache(): AuthSession | null {
  const cached = readCacheValue<unknown>(AUTH_CACHE_KEY);
  if (!cached || typeof cached !== 'object') {
    return null;
  }

  const candidate = cached as Partial<AuthSession>;
  if (typeof candidate.userId !== 'string' || !candidate.userId.trim()) {
    return null;
  }

  return {
    userId: candidate.userId,
    authenticatedAt: typeof candidate.authenticatedAt === 'number' ? candidate.authenticatedAt : Date.now(),
  };
}

export const AUTH_STORE = new InjectionToken<AuthStore>('AUTH_STORE', {
  providedIn: 'root',
  factory: createAuthStore,
});

export function injectAuthStore(): AuthStore {
  return inject(AUTH_STORE);
}
