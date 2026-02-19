import { Component, inject, Input } from '@angular/core';
import { ThemeService } from '../../../core/services/theme.service';

type ThemeToggleVariant = 'card' | 'page';

@Component({
  selector: 'app-theme-toggle-button',
  standalone: true,
  template: `
    <button type="button" [class]="buttonClasses" (click)="toggleTheme()" [attr.aria-label]="ariaLabel">
      <span class="material-symbols-outlined text-[18px]">
        {{ isDarkTheme ? 'light_mode' : 'dark_mode' }}
      </span>
    </button>
  `,
})
export class ThemeToggleButtonComponent {
  private readonly themeService = inject(ThemeService);

  @Input() variant: ThemeToggleVariant = 'card';
  @Input() switchToLightAriaLabel = 'Switch to light theme';
  @Input() switchToDarkAriaLabel = 'Switch to dark theme';

  get isDarkTheme(): boolean {
    return this.themeService.isDark();
  }

  get ariaLabel(): string {
    return this.isDarkTheme ? this.switchToLightAriaLabel : this.switchToDarkAriaLabel;
  }

  get buttonClasses(): string {
    const base =
      'h-10 px-3 rounded-full border border-slate-300 dark:border-border-dark text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors';

    if (this.variant === 'page') {
      return `${base} bg-background-light dark:bg-background-dark hover:bg-slate-100 dark:hover:bg-slate-800/60`;
    }

    return `${base} bg-white/90 dark:bg-card-dark hover:bg-white dark:hover:bg-card-dark/80`;
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }
}
