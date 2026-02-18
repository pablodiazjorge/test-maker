import { Routes } from '@angular/router';
import { activeQuizGuard } from './core/guards/active-quiz.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/quiz-config/quiz-config.component').then((m) => m.QuizConfigComponent),
  },
  {
    path: 'quiz',
    loadComponent: () =>
      import('./features/quiz-runner/quiz-runner.component').then((m) => m.QuizRunnerComponent),
    canActivate: [activeQuizGuard],
  },
  {
    path: 'results',
    loadComponent: () =>
      import('./features/quiz-results/quiz-results.component').then((m) => m.QuizResultsComponent),
    canActivate: [activeQuizGuard],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
