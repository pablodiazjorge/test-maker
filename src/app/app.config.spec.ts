import { HttpClient } from '@angular/common/http';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { httpLoaderFactory } from './app.config';

describe('app.config', () => {
  it('loads translation files from /i18n path', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    const http = TestBed.inject(HttpClient);
    const httpMock = TestBed.inject(HttpTestingController);
    const loader = httpLoaderFactory(http);

    let value: object | undefined;
    loader.getTranslation('en').subscribe((result) => {
      value = result;
    });

    const req = httpMock.expectOne('./i18n/en.json');
    expect(req.request.method).toBe('GET');
    req.flush({ key: 'value' });
    httpMock.verify();

    expect(value).toEqual({ key: 'value' });
  });
});
