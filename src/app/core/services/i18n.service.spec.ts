import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nService } from './i18n.service';

describe('I18nService', () => {
  const storageKey = 'test-maker-language';
  let service: I18nService;
  let translateMock: {
    addLangs: ReturnType<typeof vi.fn>;
    setFallbackLang: ReturnType<typeof vi.fn>;
    use: ReturnType<typeof vi.fn>;
    instant: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    translateMock = {
      addLangs: vi.fn(),
      setFallbackLang: vi.fn(),
      use: vi.fn(),
      instant: vi.fn((key: string) => `tx:${key}`),
    };

    TestBed.configureTestingModule({
      providers: [{ provide: TranslateService, useValue: translateMock }],
    });
    localStorage.clear();
    service = TestBed.inject(I18nService);
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('initializes with english by default', () => {
    service.initializeLanguage();

    expect(translateMock.addLangs).toHaveBeenCalledWith(['en', 'es']);
    expect(translateMock.setFallbackLang).toHaveBeenCalledWith('en');
    expect(translateMock.use).toHaveBeenCalledWith('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('restores stored language when valid', () => {
    localStorage.setItem(storageKey, 'es');
    service.initializeLanguage();

    expect(service.language()).toBe('es');
    expect(translateMock.use).toHaveBeenCalledWith('es');
  });

  it('toggles language', () => {
    service.setLanguage('en');
    service.toggleLanguage();

    expect(service.language()).toBe('es');
    expect(localStorage.getItem(storageKey)).toBe('es');
  });

  it('delegates translations through instant', () => {
    expect(service.t('errors.invalid_credentials')).toBe('tx:errors.invalid_credentials');
  });
});
