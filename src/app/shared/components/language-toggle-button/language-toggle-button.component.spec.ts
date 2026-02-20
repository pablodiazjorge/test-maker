import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nService } from '../../../core/services/i18n.service';
import { LanguageToggleButtonComponent } from './language-toggle-button.component';

describe('LanguageToggleButtonComponent', () => {
  let language = 'en';
  const i18n = {
    language: vi.fn(() => language),
    t: vi.fn((key: string) => key),
    toggleLanguage: vi.fn(),
  };

  beforeEach(() => {
    language = 'en';
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [{ provide: I18nService, useValue: i18n }],
    });
  });

  function createComponent(): LanguageToggleButtonComponent {
    return TestBed.runInInjectionContext(() => new LanguageToggleButtonComponent());
  }

  it('shows opposite language in label', () => {
    const component = createComponent();
    expect(component.nextLanguageLabel).toBe('ES');

    language = 'es';
    expect(component.nextLanguageLabel).toBe('EN');
  });

  it('generates translated aria-label for target language', () => {
    const component = createComponent();
    expect(component.ariaLabel).toBe('actions.switch_language_to');
  });

  it('changes classes for page variant', () => {
    const component = createComponent();
    component.variant = 'page';
    expect(component.buttonClasses).toContain('bg-background-light');
  });

  it('toggles language', () => {
    const component = createComponent();
    component.toggleLanguage();
    expect(i18n.toggleLanguage).toHaveBeenCalled();
  });
});
