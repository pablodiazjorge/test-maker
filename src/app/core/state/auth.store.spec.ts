import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { writeCacheValue } from './browser-cache';
import { AUTH_STORE, AuthStore } from './auth.store';

describe('AUTH_STORE', () => {
  const cacheKey = 'test-maker.auth.v1';
  let store: AuthStore;

  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function injectStore(): AuthStore {
    TestBed.configureTestingModule({});
    return TestBed.inject(AUTH_STORE);
  }

  it('starts unauthenticated when cache is empty', () => {
    store = injectStore();
    expect(store.session()).toBeNull();
    expect(store.isAuthenticated()).toBe(false);
    expect(store.userId()).toBeNull();
  });

  it('logs in and persists a normalized session', () => {
    vi.spyOn(Date, 'now').mockReturnValue(123456);
    store = injectStore();

    store.login('  user-1  ');

    expect(store.isAuthenticated()).toBe(true);
    expect(store.userId()).toBe('user-1');
    expect(store.session()).toEqual({ userId: 'user-1', authenticatedAt: 123456 });
    expect(localStorage.getItem(cacheKey)).toContain('"user-1"');
  });

  it('logs out and clears cache', () => {
    store = injectStore();
    store.login('user-1');
    expect(store.isAuthenticated()).toBe(true);

    store.logout();

    expect(store.session()).toBeNull();
    expect(store.isAuthenticated()).toBe(false);
    expect(localStorage.getItem(cacheKey)).toBeNull();
  });

  it('restores session from cache when valid', () => {
    writeCacheValue(cacheKey, { userId: 'cached-user', authenticatedAt: 100 });
    store = injectStore();

    expect(store.isAuthenticated()).toBe(true);
    expect(store.userId()).toBe('cached-user');
  });

  it('ignores invalid cached session data', () => {
    writeCacheValue(cacheKey, { userId: '   ', authenticatedAt: 100 });
    store = injectStore();
    expect(store.session()).toBeNull();
  });
});
