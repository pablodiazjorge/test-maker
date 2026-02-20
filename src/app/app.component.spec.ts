import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { AppComponent } from './app.component';
import { I18nService } from './core/services/i18n.service';
import { ThemeService } from './core/services/theme.service';

describe('AppComponent', () => {
  it('initializes language and theme on construction', () => {
    const i18nService = { initializeLanguage: vi.fn() };
    const themeService = { initializeTheme: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: I18nService, useValue: i18nService },
        { provide: ThemeService, useValue: themeService },
      ],
    });

    const component = TestBed.runInInjectionContext(() => new AppComponent());
    expect(component).toBeTruthy();
    expect(i18nService.initializeLanguage).toHaveBeenCalledOnce();
    expect(themeService.initializeTheme).toHaveBeenCalledOnce();
  });
});
