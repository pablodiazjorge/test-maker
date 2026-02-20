import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, importProvidersFrom, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { TranslateLoader, TranslateModule, TranslationObject } from '@ngx-translate/core';
import { routes } from './app.routes';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

class AppTranslateLoader implements TranslateLoader {
  constructor(private readonly http: HttpClient) {}

  getTranslation(lang: string): Observable<TranslationObject> {
    return this.http.get<TranslationObject>(`./i18n/${lang}.json`);
  }
}

export function httpLoaderFactory(http: HttpClient): TranslateLoader {
  return new AppTranslateLoader(http);
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(),
    provideRouter(routes),
    importProvidersFrom(
      TranslateModule.forRoot({
        fallbackLang: 'en',
        loader: {
          provide: TranslateLoader,
          useFactory: httpLoaderFactory,
          deps: [HttpClient],
        },
      }),
    ),
  ],
};
