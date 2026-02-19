import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { I18nService } from './core/services/i18n.service';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `
    <router-outlet />
  `,
  styles: [],
})
export class AppComponent {
  private readonly i18nService = inject(I18nService);
  private readonly themeService = inject(ThemeService);

  constructor() {
    this.i18nService.initializeLanguage();
    this.themeService.initializeTheme();
  }
}
