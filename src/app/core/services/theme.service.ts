import { DOCUMENT } from '@angular/common';
import { computed, inject, Injectable, signal } from '@angular/core';

type AppTheme = 'dark' | 'light';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly storageKey = 'test-maker-theme';
  private readonly _theme = signal<AppTheme>('dark');

  readonly theme = computed(() => this._theme());
  readonly isDark = computed(() => this._theme() === 'dark');

  initializeTheme(): void {
    const storedTheme = this.readStoredTheme();
    const initialTheme = storedTheme ?? this.getDefaultTheme();
    this.setTheme(initialTheme);
  }

  toggleTheme(): void {
    this.setTheme(this._theme() === 'dark' ? 'light' : 'dark');
  }

  setTheme(theme: AppTheme): void {
    this._theme.set(theme);
    this.applyThemeClass(theme);
    this.storeTheme(theme);
  }

  private applyThemeClass(theme: AppTheme): void {
    const isDark = theme === 'dark';
    this.document.documentElement.classList.toggle('dark', isDark);
    this.document.body.classList.toggle('dark', isDark);
  }

  private readStoredTheme(): AppTheme | null {
    try {
      const rawValue = localStorage.getItem(this.storageKey);
      return rawValue === 'dark' || rawValue === 'light' ? rawValue : null;
    } catch {
      return null;
    }
  }

  private storeTheme(theme: AppTheme): void {
    try {
      localStorage.setItem(this.storageKey, theme);
    } catch {
    }
  }

  private getDefaultTheme(): AppTheme {
    return this.document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  }
}

