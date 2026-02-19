import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { QuizService } from '../services/quiz.service';

export const activeQuizGuard: CanActivateFn = () => {
  const quizService = inject(QuizService);
  const router = inject(Router);
  return quizService.questions().length > 0 ? true : router.createUrlTree(['/config']);
};
