import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { QuizService } from '../services/quiz.service';
import { injectAuthStore } from '../state/auth.store';

export const authGuard: CanActivateFn = () => {
  const authStore = injectAuthStore();
  const quizService = inject(QuizService);
  const router = inject(Router);

  const session = authStore.session();
  if (session?.userId) {
    if (!quizService.isDataLoaded()) {
      const restored = quizService.restoreMasterDataFromCache(session.userId);
      if (!restored) {
        authStore.logout();
        quizService.clearMasterData({ userId: session.userId });
        return router.createUrlTree(['/']);
      }
    }
    return true;
  }

  authStore.logout();
  quizService.clearMasterData();
  return router.createUrlTree(['/']);
};
