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
    { id: 'topic-3', name: 'JS', description: 'desc' },
  ];
  const topicGroups = [
    {
      id: 'tema-3',
      name: 'Tema 3',
      description: 'Bloque principal',
      hasChildren: true,
      topicIds: ['topic-1', 'topic-2'],
      children: [topics[0], topics[1]],
    },
    {
      id: 'tema-prueba-sin-hijos',
      name: 'Tema Prueba',
      description: 'Sin hijos',
      hasChildren: false,
      topicIds: ['topic-3'],
      children: [topics[2]],
    },
  ];
  const topicCounts = new Map<string, number>([
    ['topic-1', 2],
    ['topic-2', 4],
    ['topic-3', 1],
  ]);

  const router = { navigate: vi.fn(async () => true) };
  const quizService = {
    topics,
    topicGroups,
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

  it('initializes without preselected topics', () => {
    const component = createComponent();
    component.ngOnInit();

    expect(component.selectedTopicIds).toEqual([]);
    expect(component.maxQuestionCount).toBe(0);
    expect(component.questionCount).toBe(0);
    expect(component.topicGroups).toEqual(topicGroups);
  });

  it('updates selected topics from grouped selector and syncs count', () => {
    const component = createComponent();
    component.ngOnInit();

    component.onSelectedTopicIdsChange(['topic-1', 'topic-2']);

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
    component.onSelectedTopicIdsChange(['topic-1']);

    component.onQuestionCountChange(99);
    expect(component.questionCount).toBe(2);
  });

  it('sanitizes question count input and blur', () => {
    const component = createComponent();
    component.ngOnInit();
    component.onSelectedTopicIdsChange(['topic-1']);

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

  it('logs out, clears state and navigates to login', async () => {
    const component = createComponent();
    await component.logout();

    expect(authStore.logout).toHaveBeenCalled();
    expect(quizService.clearMasterData).toHaveBeenCalledWith({ userId: 'alice' });
    expect(quizService.resetQuiz).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });
});
