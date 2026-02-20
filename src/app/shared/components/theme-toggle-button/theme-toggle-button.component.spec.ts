import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nService } from '../../../core/services/i18n.service';
import { ThemeService } from '../../../core/services/theme.service';
import { ThemeToggleButtonComponent } from './theme-toggle-button.component';

describe('ThemeToggleButtonComponent', () => {
  let isDark = true;
  const i18n = { t: vi.fn((key: string) => key) };
  const themeService = {
    isDark: vi.fn(() => isDark),
    toggleTheme: vi.fn(),
  };

  beforeEach(() => {
    isDark = true;
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        { provide: I18nService, useValue: i18n },
        { provide: ThemeService, useValue: themeService },
      ],
    });
  });

  function createComponent(): ThemeToggleButtonComponent {
    return TestBed.runInInjectionContext(() => new ThemeToggleButtonComponent());
  }

  it('builds aria-label from current theme', () => {
    const component = createComponent();
    expect(component.ariaLabel).toBe('actions.switch_to_light_theme');

    isDark = false;
    expect(component.ariaLabel).toBe('actions.switch_to_dark_theme');
  });

  it('changes class style based on variant', () => {
    const component = createComponent();
    component.variant = 'card';
    expect(component.buttonClasses).toContain('bg-white/90');

    component.variant = 'page';
    expect(component.buttonClasses).toContain('bg-background-light');
  });

  it('toggles theme on button action', () => {
    const component = createComponent();
    component.toggleTheme();
    expect(themeService.toggleTheme).toHaveBeenCalled();
  });
});
