import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nService } from '../../core/services/i18n.service';
import { QuizService } from '../../core/services/quiz.service';
import { AUTH_STORE } from '../../core/state/auth.store';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let httpMock: HttpTestingController;

  const router = { navigate: vi.fn(async () => true) };
  const i18n = { t: vi.fn((key: string) => key) };
  const quizService = {
    isDataLoaded: vi.fn(() => false),
    restoreMasterDataFromCache: vi.fn(() => false),
    clearMasterData: vi.fn(),
    setMasterData: vi.fn(() => true),
  };
  const authStore = {
    session: vi.fn(() => null),
    login: vi.fn(),
    logout: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: router },
        { provide: I18nService, useValue: i18n },
        { provide: QuizService, useValue: quizService },
        { provide: AUTH_STORE, useValue: authStore },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    component = TestBed.runInInjectionContext(() => new LoginComponent());
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('fills guest credentials', () => {
    component.useGuestCredentials();
    expect(component.username()).toBe('invitado');
    expect(component.password()).toBe('invcont123');
    expect(component.errorMessage()).toBeNull();
  });

  it('validates required username', async () => {
    component.username.set('   ');
    component.password.set('secret');

    await component.login({ preventDefault: vi.fn() } as unknown as Event);

    expect(component.errorMessage()).toBe('errors.username_required');
    expect(component.isSubmitting()).toBe(false);
  });

  it('validates required password', async () => {
    component.username.set('user');
    component.password.set('   ');

    await component.login({ preventDefault: vi.fn() } as unknown as Event);

    expect(component.errorMessage()).toBe('errors.password_required');
    expect(component.isSubmitting()).toBe(false);
  });

  it('logs in and navigates to config when credentials are valid', async () => {
    component.username.set(' user ');
    component.password.set(' pass ');

    const promise = component.login({ preventDefault: vi.fn() } as unknown as Event);
    const req = httpMock.expectOne('/api/get-data');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ username: 'user', password: 'pass' });
    req.flush({ userId: 'alice', data: [] });
    await promise;

    expect(quizService.setMasterData).toHaveBeenCalledWith([], 'alice');
    expect(authStore.login).toHaveBeenCalledWith('alice');
    expect(router.navigate).toHaveBeenCalledWith(['/config']);
    expect(component.username()).toBe('');
    expect(component.password()).toBe('');
    expect(component.isSubmitting()).toBe(false);
  });

  it('shows translated unauthorized error for 401 responses', async () => {
    component.username.set('user');
    component.password.set('pass');

    const promise = component.login({ preventDefault: vi.fn() } as unknown as Event);
    const req = httpMock.expectOne('/api/get-data');
    req.flush({ message: 'bad credentials' }, { status: 401, statusText: 'Unauthorized' });
    await promise;

    expect(component.errorMessage()).toBe('errors.invalid_credentials');
    expect(component.isSubmitting()).toBe(false);
  });
});
