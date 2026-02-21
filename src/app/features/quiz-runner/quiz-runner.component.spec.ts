import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuizService } from '../../core/services/quiz.service';
import { QuizRunnerComponent } from './quiz-runner.component';

describe('QuizRunnerComponent', () => {
  const questionsState: Array<{
    id: string;
    topicId: string;
    text: string;
    options: Array<{ id: string; text: string }>;
    correctOptionId: string;
    userSelectedOptionId: string | null;
  }> = [
    {
      id: 'q-1',
      topicId: 'topic-1',
      text: 'Question 1',
      options: [
        { id: 'a', text: 'Option A' },
        { id: 'b', text: 'Option B' },
        { id: 'c', text: 'Option C' },
        { id: 'd', text: 'Option D' },
      ],
      correctOptionId: 'a',
      userSelectedOptionId: null,
    },
    {
      id: 'q-2',
      topicId: 'topic-1',
      text: 'Question 2',
      options: [{ id: 'b', text: 'B' }],
      correctOptionId: 'b',
      userSelectedOptionId: null,
    },
  ];
  let currentIndex = 0;

  const router = { navigate: vi.fn(async () => true) };
  const quizService = {
    questions: vi.fn(() => questionsState),
    currentQuestion: vi.fn(() => questionsState[currentIndex]),
    currentIndex: vi.fn(() => currentIndex),
    totalQuestions: vi.fn(() => questionsState.length),
    progress: vi.fn(() => 50),
    selectAnswer: vi.fn(),
    goToQuestion: vi.fn(),
    previousQuestion: vi.fn(),
    nextQuestion: vi.fn(),
    resetQuiz: vi.fn(),
  };

  beforeEach(() => {
    currentIndex = 0;
    questionsState[0].userSelectedOptionId = null;
    questionsState[1].userSelectedOptionId = null;
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        { provide: QuizService, useValue: quizService },
        { provide: Router, useValue: router },
      ],
    });
  });

  function createComponent(): QuizRunnerComponent {
    return TestBed.runInInjectionContext(() => new QuizRunnerComponent());
  }

  it('converts input question number to zero-based index', () => {
    const component = createComponent();
    component.goToQuestion('2');
    expect(quizService.goToQuestion).toHaveBeenCalledWith(1);
  });

  it('continues to next question when not on last question', () => {
    const component = createComponent();
    currentIndex = 0;

    component.continueQuiz();

    expect(quizService.nextQuestion).toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('navigates to results when continuing from last question', () => {
    const component = createComponent();
    currentIndex = 1;

    component.continueQuiz();

    expect(router.navigate).toHaveBeenCalledWith(['/results']);
  });

  it('selects answer and continues on double action', () => {
    const component = createComponent();
    const continueSpy = vi.spyOn(component, 'continueQuiz');

    component.selectAndContinue('q-1', 'a');

    expect(quizService.selectAnswer).toHaveBeenCalledWith('q-1', 'a');
    expect(continueSpy).toHaveBeenCalled();
  });

  it('handles keyboard arrows and enter shortcut', () => {
    const component = createComponent();
    const leftEvent = { key: 'ArrowLeft', preventDefault: vi.fn(), target: document.body } as unknown as KeyboardEvent;
    component.onKeydown(leftEvent);
    expect(leftEvent.preventDefault).toHaveBeenCalled();
    expect(quizService.previousQuestion).toHaveBeenCalled();

    const rightEvent = {
      key: 'ArrowRight',
      preventDefault: vi.fn(),
      target: document.body,
    } as unknown as KeyboardEvent;
    component.onKeydown(rightEvent);
    expect(rightEvent.preventDefault).toHaveBeenCalled();
    expect(quizService.nextQuestion).toHaveBeenCalled();

    questionsState[0].userSelectedOptionId = 'a';
    currentIndex = 0;
    const enterEvent = { key: 'Enter', preventDefault: vi.fn(), target: document.body } as unknown as KeyboardEvent;
    component.onKeydown(enterEvent);
    expect(enterEvent.preventDefault).toHaveBeenCalled();
  });

  it('selects option by numeric key 1-4', () => {
    const component = createComponent();
    currentIndex = 0;

    const key1Event = { key: '1', preventDefault: vi.fn(), target: document.body } as unknown as KeyboardEvent;
    component.onKeydown(key1Event);
    expect(key1Event.preventDefault).toHaveBeenCalled();
    expect(quizService.selectAnswer).toHaveBeenCalledWith('q-1', 'a');

    vi.clearAllMocks();
    const key2Event = { key: '2', preventDefault: vi.fn(), target: document.body } as unknown as KeyboardEvent;
    component.onKeydown(key2Event);
    expect(key2Event.preventDefault).toHaveBeenCalled();
    expect(quizService.selectAnswer).toHaveBeenCalledWith('q-1', 'b');

    vi.clearAllMocks();
    const key3Event = { key: '3', preventDefault: vi.fn(), target: document.body } as unknown as KeyboardEvent;
    component.onKeydown(key3Event);
    expect(key3Event.preventDefault).toHaveBeenCalled();
    expect(quizService.selectAnswer).toHaveBeenCalledWith('q-1', 'c');

    vi.clearAllMocks();
    const key4Event = { key: '4', preventDefault: vi.fn(), target: document.body } as unknown as KeyboardEvent;
    component.onKeydown(key4Event);
    expect(key4Event.preventDefault).toHaveBeenCalled();
    expect(quizService.selectAnswer).toHaveBeenCalledWith('q-1', 'd');
  });

  it('ignores numeric key when option index does not exist', () => {
    const component = createComponent();
    currentIndex = 1;

    const key3Event = { key: '3', preventDefault: vi.fn(), target: document.body } as unknown as KeyboardEvent;
    component.onKeydown(key3Event);
    expect(key3Event.preventDefault).not.toHaveBeenCalled();
    expect(quizService.selectAnswer).not.toHaveBeenCalled();
  });

  it('ignores keyboard shortcuts on input targets', () => {
    const component = createComponent();
    const event = {
      key: 'ArrowRight',
      preventDefault: vi.fn(),
      target: document.createElement('input'),
    } as unknown as KeyboardEvent;

    component.onKeydown(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(quizService.nextQuestion).not.toHaveBeenCalled();
  });

  it('returns labels and class variants for selected options', () => {
    const component = createComponent();
    const question = questionsState[0];
    const option = question.options[0];

    expect(component.optionLabel(0)).toBe('A');
    expect(component.optionButtonClasses(question, option)).toContain('border-slate-200');
    expect(component.optionBadgeClasses(question, option)).toContain('bg-slate-100');

    question.userSelectedOptionId = 'a';
    expect(component.optionButtonClasses(question, option)).toContain('border-2 border-primary');
    expect(component.optionBadgeClasses(question, option)).toContain('bg-primary');
    expect(component.optionTextClasses(question, option)).toContain('font-semibold');
  });

  it('finishes and restarts quiz', () => {
    const component = createComponent();

    component.finishQuiz();
    expect(router.navigate).toHaveBeenCalledWith(['/results']);

    component.restart();
    expect(quizService.resetQuiz).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/config']);
  });
});
