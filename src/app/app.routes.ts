import { Routes } from '@angular/router';
import { activeQuizGuard } from './core/guards/active-quiz.guard';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'config',
    loadComponent: () =>
      import('./features/quiz-config/quiz-config.component').then((m) => m.QuizConfigComponent),
    canActivate: [authGuard],
  },
  {
    path: 'quiz',
    loadComponent: () =>
      import('./features/quiz-runner/quiz-runner.component').then((m) => m.QuizRunnerComponent),
    canActivate: [authGuard, activeQuizGuard],
  },
  {
    path: 'results',
    loadComponent: () =>
      import('./features/quiz-results/quiz-results.component').then((m) => m.QuizResultsComponent),
    canActivate: [authGuard, activeQuizGuard],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
