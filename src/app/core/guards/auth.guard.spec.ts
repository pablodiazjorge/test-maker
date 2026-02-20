import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { QuizService } from '../services/quiz.service';
import { AUTH_STORE } from '../state/auth.store';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  function runGuard() {
    return TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
  }

  it('allows navigation when session exists and data is loaded', () => {
    const authStore = {
      session: () => ({ userId: 'alice', authenticatedAt: 1 }),
      logout: vi.fn(),
    };
    const quizService = {
      isDataLoaded: vi.fn(() => true),
      restoreMasterDataFromCache: vi.fn(),
      clearMasterData: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AUTH_STORE, useValue: authStore },
        { provide: QuizService, useValue: quizService },
        { provide: Router, useValue: { createUrlTree: vi.fn(() => 'redirect') } },
      ],
    });

    expect(runGuard()).toBe(true);
    expect(quizService.restoreMasterDataFromCache).not.toHaveBeenCalled();
  });

  it('allows navigation when cache restoration succeeds', () => {
    const authStore = {
      session: () => ({ userId: 'alice', authenticatedAt: 1 }),
      logout: vi.fn(),
    };
    const quizService = {
      isDataLoaded: vi.fn(() => false),
      restoreMasterDataFromCache: vi.fn(() => true),
      clearMasterData: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AUTH_STORE, useValue: authStore },
        { provide: QuizService, useValue: quizService },
        { provide: Router, useValue: { createUrlTree: vi.fn(() => 'redirect') } },
      ],
    });

    expect(runGuard()).toBe(true);
    expect(quizService.restoreMasterDataFromCache).toHaveBeenCalledWith('alice');
  });

  it('logs out and redirects when restoration fails', () => {
    const authStore = {
      session: () => ({ userId: 'alice', authenticatedAt: 1 }),
      logout: vi.fn(),
    };
    const quizService = {
      isDataLoaded: vi.fn(() => false),
      restoreMasterDataFromCache: vi.fn(() => false),
      clearMasterData: vi.fn(),
    };
    const router = { createUrlTree: vi.fn(() => 'redirect') };

    TestBed.configureTestingModule({
      providers: [
        { provide: AUTH_STORE, useValue: authStore },
        { provide: QuizService, useValue: quizService },
        { provide: Router, useValue: router },
      ],
    });

    expect(runGuard()).toBe('redirect');
    expect(authStore.logout).toHaveBeenCalled();
    expect(quizService.clearMasterData).toHaveBeenCalledWith({ userId: 'alice' });
  });

  it('logs out and redirects when there is no session', () => {
    const authStore = {
      session: () => null,
      logout: vi.fn(),
    };
    const quizService = {
      isDataLoaded: vi.fn(() => false),
      restoreMasterDataFromCache: vi.fn(() => false),
      clearMasterData: vi.fn(),
    };
    const router = { createUrlTree: vi.fn(() => 'redirect') };

    TestBed.configureTestingModule({
      providers: [
        { provide: AUTH_STORE, useValue: authStore },
        { provide: QuizService, useValue: quizService },
        { provide: Router, useValue: router },
      ],
    });

    expect(runGuard()).toBe('redirect');
    expect(authStore.logout).toHaveBeenCalled();
    expect(quizService.clearMasterData).toHaveBeenCalled();
  });
});
