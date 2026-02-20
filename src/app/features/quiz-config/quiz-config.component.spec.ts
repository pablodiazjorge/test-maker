import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuizService } from '../../core/services/quiz.service';
import { AUTH_STORE } from '../../core/state/auth.store';
import { QuizConfigComponent } from './quiz-config.component';

describe('QuizConfigComponent', () => {
  const topics = [
    { id: 'topic-1', name: 'HTML', description: 'desc' },
    { id: 'topic-2', name: 'CSS', description: 'desc' },
  ];
  const topicCounts = new Map<string, number>([
    ['topic-1', 2],
    ['topic-2', 4],
  ]);

  const router = { navigate: vi.fn(async () => true) };
  const quizService = {
    topics,
    getQuestionCountForTopics: vi.fn((topicIds: string[]) =>
      topicIds.reduce((sum, id) => sum + (topicCounts.get(id) ?? 0), 0),
    ),
    startQuiz: vi.fn(),
    clearMasterData: vi.fn(),
    resetQuiz: vi.fn(),
  };
  const authStore = {
    session: vi.fn(() => ({ userId: 'alice', authenticatedAt: 1 })),
    logout: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    });
    TestBed.configureTestingModule({
      providers: [
        { provide: QuizService, useValue: quizService },
        { provide: Router, useValue: router },
        { provide: AUTH_STORE, useValue: authStore },
      ],
    });
  });

  function createComponent(): QuizConfigComponent {
    return TestBed.runInInjectionContext(() => new QuizConfigComponent());
  }

  it('initializes with selected topic and max question count', () => {
    const component = createComponent();
    component.ngOnInit();

    expect(component.selectedTopicIds).toEqual(['topic-1']);
    expect(component.maxQuestionCount).toBe(2);
    expect(component.questionCount).toBe(2);
  });

  it('toggles topic selection and syncs question count', () => {
    const component = createComponent();
    component.ngOnInit();

    component.toggleTopic('topic-2');

    expect(component.selectedTopicIds).toEqual(['topic-1', 'topic-2']);
    expect(component.maxQuestionCount).toBe(6);
    expect(component.questionCount).toBe(6);
  });

  it('shows validation error when trying to start without selected topics', () => {
    const component = createComponent();
    component.ngOnInit();
    component.selectedTopicIds = [];

    component.startQuiz();

    expect(component.showTopicValidationError).toBe(true);
    expect(quizService.startQuiz).not.toHaveBeenCalled();
  });

  it('starts quiz and navigates to runner', () => {
    const component = createComponent();
    component.ngOnInit();
    component.selectedTopicIds = ['topic-1', 'topic-2'];
    component.questionCount = 10;

    component.startQuiz();

    expect(quizService.startQuiz).toHaveBeenCalledWith({
      questionCount: 6,
      shuffleQuestions: true,
      shuffleAnswers: false,
      selectedTopicIds: ['topic-1', 'topic-2'],
    });
    expect(router.navigate).toHaveBeenCalledWith(['/quiz']);
  });

  it('clamps numeric input based on selected pool', () => {
    const component = createComponent();
    component.ngOnInit();

    component.onQuestionCountChange(99);
    expect(component.questionCount).toBe(2);
  });

  it('sanitizes question count input and blur', () => {
    const component = createComponent();
    component.ngOnInit();

    const input = document.createElement('input');
    input.value = '999';
    component.onQuestionCountInput({ target: input } as unknown as Event);
    expect(component.questionCount).toBe(2);
    expect(input.value).toBe('2');

    component.questionCount = 0;
    component.onQuestionCountBlur();
    expect(component.questionCount).toBe(1);
  });

  it('prevents invalid numeric keyboard input', () => {
    const component = createComponent();
    const event = { key: 'e', preventDefault: vi.fn() } as unknown as KeyboardEvent;
    component.blockInvalidNumberInput(event);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('builds selected and unselected topic classes', () => {
    const component = createComponent();
    component.ngOnInit();
    expect(component.topicButtonClasses('topic-1')).toContain('ring-1');
    expect(component.topicNameClasses('topic-1')).toContain('text-primary');
    expect(component.topicIndicatorClasses('topic-1')).toContain('bg-primary/10');

    expect(component.topicButtonClasses('topic-2')).toContain('group');
    expect(component.topicNameClasses('topic-2')).toContain('group-hover:text-primary');
    expect(component.topicIndicatorClasses('topic-2')).toContain('group-hover:border-primary');
  });

  it('blurs topic target when toggled by mouse click', () => {
    const component = createComponent();
    component.ngOnInit();
    const target = document.createElement('button');
    const blurSpy = vi.spyOn(target, 'blur');
    const event = new MouseEvent('click', { detail: 1 });
    Object.defineProperty(event, 'currentTarget', { value: target });

    component.toggleTopic('topic-2', event);

    expect(blurSpy).toHaveBeenCalled();
  });

  it('logs out, clears state and navigates to login', async () => {
    const component = createComponent();
    await component.logout();

    expect(authStore.logout).toHaveBeenCalled();
    expect(quizService.clearMasterData).toHaveBeenCalledWith({ userId: 'alice' });
    expect(quizService.resetQuiz).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });
});
