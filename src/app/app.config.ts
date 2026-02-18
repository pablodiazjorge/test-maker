import { provideHttpClient } from '@angular/common/http';
import { APP_INITIALIZER, ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { QuizService } from './core/services/quiz.service';

import { routes } from './app.routes';

function initializeMasterData(quizService: QuizService): () => Promise<void> {
  return () =>
    quizService.loadMasterData().catch((error) => {
      console.error('Failed to load master-data.json', error);
    });
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(),
    provideRouter(routes),
    {
      provide: APP_INITIALIZER,
      multi: true,
      deps: [QuizService],
      useFactory: initializeMasterData,
    },
  ]
};
