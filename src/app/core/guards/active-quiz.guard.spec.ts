import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { QuizService } from '../services/quiz.service';
import { activeQuizGuard } from './active-quiz.guard';

describe('activeQuizGuard', () => {
  function runGuard() {
    return TestBed.runInInjectionContext(() => activeQuizGuard({} as never, {} as never));
  }

  it('allows route activation when there are active questions', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: QuizService, useValue: { questions: () => [{ id: 'q-1' }] } },
        { provide: Router, useValue: { createUrlTree: vi.fn(() => 'redirect') } },
      ],
    });

    expect(runGuard()).toBe(true);
  });

  it('redirects to config when there are no active questions', () => {
    const router = { createUrlTree: vi.fn(() => 'redirect') };
    TestBed.configureTestingModule({
      providers: [
        { provide: QuizService, useValue: { questions: () => [] } },
        { provide: Router, useValue: router },
      ],
    });

    expect(runGuard()).toBe('redirect');
    expect(router.createUrlTree).toHaveBeenCalledWith(['/config']);
  });
});
