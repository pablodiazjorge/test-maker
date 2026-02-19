import { DOCUMENT } from '@angular/core';
import { computed, inject, Injectable, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export type AppLanguage = 'en' | 'es';

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly document = inject(DOCUMENT);
  private readonly translate = inject(TranslateService);
  private readonly storageKey = 'test-maker-language';
  private readonly supportedLanguages: AppLanguage[] = ['en', 'es'];
  private readonly _language = signal<AppLanguage>('en');

  readonly language = computed(() => this._language());
  readonly isSpanish = computed(() => this._language() === 'es');

  initializeLanguage(): void {
    this.translate.addLangs(this.supportedLanguages);
    this.translate.setFallbackLang('en');

    const storedLanguage = this.readStoredLanguage();
    this.setLanguage(storedLanguage ?? 'en');
  }

  setLanguage(language: AppLanguage): void {
    this._language.set(language);
    this.translate.use(language);
    this.document.documentElement.lang = language;
    this.storeLanguage(language);
  }

  toggleLanguage(): void {
    this.setLanguage(this._language() === 'en' ? 'es' : 'en');
  }

  t(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params);
  }

  private readStoredLanguage(): AppLanguage | null {
    try {
      const rawValue = localStorage.getItem(this.storageKey);
      return rawValue === 'en' || rawValue === 'es' ? rawValue : null;
    } catch {
      return null;
    }
  }

  private storeLanguage(language: AppLanguage): void {
    try {
      localStorage.setItem(this.storageKey, language);
    } catch {
      // Ignore storage failures to avoid breaking runtime UX.
    }
  }
}
