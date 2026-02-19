import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { QuizService } from '../services/quiz.service';
import { injectAuthStore } from '../state/auth.store';

export const authGuard: CanActivateFn = () => {
  const authStore = injectAuthStore();
  const quizService = inject(QuizService);
  const router = inject(Router);
  const hasValidSession = authStore.isAuthenticated() && quizService.isDataLoaded();
  if (hasValidSession) {
    return true;
  }

  authStore.logout();
  quizService.clearMasterData();
  return router.createUrlTree(['/']);
};
