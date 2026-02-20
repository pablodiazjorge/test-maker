import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;
  const storageKey = 'test-maker-theme';

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ThemeService);
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark');
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('initializes using stored theme when available', () => {
    localStorage.setItem(storageKey, 'light');
    service.initializeTheme();

    expect(service.theme()).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.body.classList.contains('dark')).toBe(false);
  });

  it('initializes from document class when no theme is stored', () => {
    document.documentElement.classList.add('dark');
    service.initializeTheme();
    expect(service.theme()).toBe('dark');
    expect(service.isDark()).toBe(true);
  });

  it('toggles theme and persists value', () => {
    service.setTheme('dark');
    service.toggleTheme();

    expect(service.theme()).toBe('light');
    expect(localStorage.getItem(storageKey)).toBe('light');
  });

  it('applies dark classes to document and body', () => {
    service.setTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.body.classList.contains('dark')).toBe(true);
  });
});
