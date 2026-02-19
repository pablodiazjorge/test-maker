import { Component, inject, Input } from '@angular/core';
import { I18nService } from '../../../core/services/i18n.service';

type LanguageToggleVariant = 'card' | 'page';

@Component({
  selector: 'app-language-toggle-button',
  standalone: true,
  template: `
    <button type="button" [class]="buttonClasses" (click)="toggleLanguage()" [attr.aria-label]="ariaLabel">
      <span class="text-[11px] font-bold tracking-wide">{{ nextLanguageLabel }}</span>
    </button>
  `,
})
export class LanguageToggleButtonComponent {
  private readonly i18n = inject(I18nService);

  @Input() variant: LanguageToggleVariant = 'card';

  get nextLanguageLabel(): string {
    return this.i18n.language() === 'en' ? 'ES' : 'EN';
  }

  get ariaLabel(): string {
    const targetLanguage = this.i18n.language() === 'en' ? this.i18n.t('languages.spanish') : this.i18n.t('languages.english');
    return this.i18n.t('actions.switch_language_to', { language: targetLanguage });
  }

  get buttonClasses(): string {
    const base =
      'h-10 px-3 rounded-full border border-slate-300 dark:border-border-dark text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center transition-colors';

    if (this.variant === 'page') {
      return `${base} bg-background-light dark:bg-background-dark hover:bg-slate-100 dark:hover:bg-slate-800/60`;
    }

    return `${base} bg-white/90 dark:bg-card-dark hover:bg-white dark:hover:bg-card-dark/80`;
  }

  toggleLanguage(): void {
    this.i18n.toggleLanguage();
  }
}
