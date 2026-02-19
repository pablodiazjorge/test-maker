import { inject, InjectionToken, Signal, signal } from '@angular/core';
import { clearCacheValue, readCacheValue, writeCacheValue } from './browser-cache';

export interface AuthStore {
  readonly isAuthenticated: Signal<boolean>;
  login: () => void;
  logout: () => void;
}

const AUTH_CACHE_KEY = 'test-maker.auth.v1';

function createAuthStore(): AuthStore {
  const authenticated = signal(readCacheValue<boolean>(AUTH_CACHE_KEY) === true);

  return {
    isAuthenticated: authenticated.asReadonly(),
    login: () => {
      authenticated.set(true);
      writeCacheValue(AUTH_CACHE_KEY, true);
    },
    logout: () => {
      authenticated.set(false);
      clearCacheValue(AUTH_CACHE_KEY);
    },
  };
}

export const AUTH_STORE = new InjectionToken<AuthStore>('AUTH_STORE', {
  providedIn: 'root',
  factory: createAuthStore,
});

export function injectAuthStore(): AuthStore {
  return inject(AUTH_STORE);
}
