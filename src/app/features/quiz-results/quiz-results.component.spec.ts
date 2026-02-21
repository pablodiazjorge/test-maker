import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nService } from '../../core/services/i18n.service';
import { QuizService } from '../../core/services/quiz.service';
import { QuizResultsComponent } from './quiz-results.component';

describe('QuizResultsComponent', () => {
  const questions = [
    {
      id: 'q-1',
      topicId: 'topic-1',
      text: 'Question 1',
      options: [
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
      ],
      correctOptionId: 'a',
      userSelectedOptionId: 'a',
    },
    {
      id: 'q-2',
      topicId: 'topic-1',
      text: 'Question 2',
      options: [
        { id: 'c', text: 'C' },
        { id: 'd', text: 'D' },
      ],
      correctOptionId: 'c',
      userSelectedOptionId: 'd',
    },
    {
      id: 'q-3',
      topicId: 'topic-2',
      text: 'Question 3',
      options: [
        { id: 'e', text: 'E' },
        { id: 'f', text: 'F' },
      ],
      correctOptionId: 'e',
      userSelectedOptionId: null,
    },
  ];

  const results = {
    total: 3,
    answered: 2,
    correct: 1,
    incorrect: 1,
    unanswered: 1,
    scorePercent: 33,
    byTopic: [],
  };

  const quizService = {
    results: vi.fn(() => results),
    questions: vi.fn(() => questions),
    topics: [
      { id: 'topic-1', name: 'HTML', description: 'desc' },
      { id: 'topic-2', name: 'CSS', description: 'desc' },
    ],
    resetQuiz: vi.fn(),
  };
  const router = { navigate: vi.fn(async () => true) };
  const i18n = {
    language: vi.fn(() => 'en'),
    t: vi.fn((key: string) => key),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    delete window.jspdf;
    TestBed.configureTestingModule({
      providers: [
        { provide: QuizService, useValue: quizService },
        { provide: Router, useValue: router },
        { provide: I18nService, useValue: i18n },
      ],
    });
  });

  function createComponent(): QuizResultsComponent {
    return TestBed.runInInjectionContext(() => new QuizResultsComponent());
  }

  it('filters incorrect and unanswered questions', () => {
    const component = createComponent();

    component.setFilter('incorrect');
    expect(component.filteredQuestions()).toHaveLength(1);
    expect(component.filteredQuestions()[0].id).toBe('q-2');

    component.setFilter('unanswered');
    expect(component.filteredQuestions()).toHaveLength(1);
    expect(component.filteredQuestions()[0].id).toBe('q-3');
  });

  it('returns stable question numbers based on order', () => {
    const component = createComponent();
    expect(component.questionNumber('q-1')).toBe(1);
    expect(component.questionNumber('q-3')).toBe(3);
  });

  it('resolves topic names by topic id', () => {
    const component = createComponent();
    expect(component.topicName('topic-1')).toBe('HTML');
    expect(component.topicName('missing')).toBe('missing');
  });

  it('returns proper option markers for review states', () => {
    const component = createComponent();
    expect(component.optionMarker(questions[1], questions[1].options[1])).toBe('close');
    expect(component.optionMarker(questions[1], questions[1].options[0])).toBe('correct');
    expect(component.optionMarker(questions[2], questions[2].options[0])).toBe('answer');
  });

  it('resolves question status and card styles for each state', () => {
    const component = createComponent();

    expect(component.isCorrect(questions[0])).toBe(true);
    expect(component.isIncorrect(questions[1])).toBe(true);
    expect(component.isUnanswered(questions[2])).toBe(true);

    expect(component.questionCardClasses(questions[1])).toContain('border-error');
    expect(component.questionCardClasses(questions[0])).toContain('border-slate-200');

    expect(component.questionStatusIcon(questions[0])).toBe('check');
    expect(component.questionStatusIcon(questions[1])).toBe('close');
    expect(component.questionStatusIcon(questions[2])).toBe('remove');

    expect(component.questionTitleClasses(questions[0])).toContain('text-success');
    expect(component.questionTitleClasses(questions[1])).toContain('text-error');
    expect(component.questionTitleClasses(questions[2])).toContain('text-slate-500');
  });

  it('returns class variants for option rows and indicators', () => {
    const component = createComponent();

    expect(component.optionRowClasses(questions[1], questions[1].options[1])).toContain('border-error');
    expect(component.optionRowClasses(questions[1], questions[1].options[0])).toContain('border-success');
    expect(component.optionRowClasses(questions[0], questions[0].options[0])).toContain('border-success');
    expect(component.optionRowClasses(questions[2], questions[2].options[0])).toContain('border-dashed');

    expect(component.optionIndicatorClasses(questions[1], questions[1].options[1])).toContain('border-error');
    expect(component.optionIndicatorClasses(questions[1], questions[1].options[0])).toContain('border-success');
    expect(component.optionIndicatorClasses(questions[0], questions[0].options[0])).toContain('bg-success');
    expect(component.optionIndicatorClasses(questions[2], questions[2].options[0])).toContain('border-primary/60');
  });

  it('returns class variants for option text and filter buttons', () => {
    const component = createComponent();

    expect(component.optionTextClasses(questions[1], questions[1].options[1])).toContain('text-error');
    expect(component.optionTextClasses(questions[1], questions[1].options[0])).toContain('text-slate-800');
    expect(component.optionTextClasses(questions[2], questions[2].options[0])).toContain('text-slate-800');
    expect(component.optionTextClasses(questions[0], questions[0].options[1])).toContain('text-slate-500');

    component.setFilter('all');
    expect(component.filterButtonClasses('all')).toContain('bg-white');
    expect(component.filterButtonClasses('incorrect')).toContain('text-slate-500');
  });

  it('shows export error when pdf library is unavailable', async () => {
    const component = createComponent();
    await component.exportPdf();
    expect(component.exportError()).toBe('errors.pdf_lib_unavailable');
    expect(component.isExporting()).toBe(false);
  });

  it('exports report with jspdf when library is available', async () => {
    const pdfMock = {
      internal: {
        pageSize: {
          getWidth: () => 595,
          getHeight: () => 842,
        },
      },
      setFont: vi.fn(),
      setFontSize: vi.fn(),
      setTextColor: vi.fn(),
      setDrawColor: vi.fn(),
      setFillColor: vi.fn(),
      rect: vi.fn(),
      text: vi.fn(),
      splitTextToSize: vi.fn((text: string) => [text]),
      getTextWidth: vi.fn(() => 50),
      line: vi.fn(),
      addPage: vi.fn(),
      save: vi.fn(),
    };
    const constructorMock = vi.fn(function JsPdfMock() {
      return pdfMock;
    });
    window.jspdf = { jsPDF: constructorMock as never };

    const component = createComponent();
    component.setFilter('incorrect');
    await component.exportPdf();

    expect(constructorMock).toHaveBeenCalled();
    expect(pdfMock.save).toHaveBeenCalledOnce();
    expect(i18n.t).toHaveBeenCalledWith('actions.incorrect');
    expect(component.exportError()).toBeNull();
    expect(component.isExporting()).toBe(false);
  });

  it('resets quiz and navigates back to config', () => {
    const component = createComponent();
    component.backToSetup();
    expect(quizService.resetQuiz).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/config']);
  });
});
