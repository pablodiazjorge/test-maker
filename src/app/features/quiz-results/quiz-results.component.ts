import { Component, computed, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Option, Question } from '../../core/data/quiz.data';
import { QuizService } from '../../core/services/quiz.service';

type ResultsFilter = 'all' | 'incorrect' | 'unanswered';

type Html2CanvasFn = (
  element: HTMLElement,
  options?: { scale?: number; useCORS?: boolean; backgroundColor?: string },
) => Promise<HTMLCanvasElement>;

interface JsPdfInstance {
  internal: {
    pageSize: {
      getWidth(): number;
      getHeight(): number;
    };
  };
  addImage(
    imageData: string,
    format: 'PNG',
    x: number,
    y: number,
    width: number,
    height: number,
  ): void;
  addPage(): void;
  save(fileName: string): void;
}

interface JsPdfConstructor {
  new (orientation: 'p', unit: 'pt', format: 'a4'): JsPdfInstance;
}

declare global {
  interface Window {
    html2canvas?: Html2CanvasFn;
    jspdf?: {
      jsPDF?: JsPdfConstructor;
    };
  }
}

@Component({
  selector: 'app-quiz-results',
  standalone: true,
  templateUrl: './quiz-results.component.html',
})
export class QuizResultsComponent {
  private readonly quizService = inject(QuizService);
  private readonly router = inject(Router);

  @ViewChild('resultsContainer') resultsContainer?: ElementRef<HTMLElement>;

  readonly results = this.quizService.results;
  readonly questions = this.quizService.questions;

  readonly filter = signal<ResultsFilter>('all');
  readonly isExporting = signal(false);
  readonly exportError = signal<string | null>(null);

  readonly filteredQuestions = computed(() => {
    const questions = this.questions();
    const filter = this.filter();
    if (filter === 'incorrect') {
      return questions.filter((question) => this.isIncorrect(question));
    }
    if (filter === 'unanswered') {
      return questions.filter((question) => this.isUnanswered(question));
    }
    return questions;
  });

  readonly questionOrder = computed(() => {
    const order = new Map<string, number>();
    this.questions().forEach((question, index) => {
      order.set(question.id, index + 1);
    });
    return order;
  });

  setFilter(filter: ResultsFilter): void {
    this.filter.set(filter);
  }

  filterButtonClasses(filter: ResultsFilter): string {
    if (this.filter() === filter) {
      return 'flex-1 py-1.5 px-3 text-sm font-medium rounded-md bg-white dark:bg-primary shadow-sm text-slate-900 dark:text-white transition-all';
    }
    return 'flex-1 py-1.5 px-3 text-sm font-medium rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-all';
  }

  questionNumber(questionId: string): number {
    return this.questionOrder().get(questionId) ?? 0;
  }

  topicName(topicId: string): string {
    return this.quizService.topics.find((topic) => topic.id === topicId)?.name ?? topicId;
  }

  isCorrect(question: Question): boolean {
    return !!question.userSelectedOptionId && question.userSelectedOptionId === question.correctOptionId;
  }

  isIncorrect(question: Question): boolean {
    return !!question.userSelectedOptionId && question.userSelectedOptionId !== question.correctOptionId;
  }

  isUnanswered(question: Question): boolean {
    return !question.userSelectedOptionId;
  }

  isSelectedOption(question: Question, option: Option): boolean {
    return question.userSelectedOptionId === option.id;
  }

  isCorrectOption(question: Question, option: Option): boolean {
    return question.correctOptionId === option.id;
  }

  questionCardClasses(question: Question): string {
    if (this.isIncorrect(question)) {
      return 'bg-white dark:bg-surface-dark rounded-xl border border-error/30 dark:border-error/40 overflow-hidden shadow-sm';
    }
    return 'bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-surface-highlight overflow-hidden shadow-sm';
  }

  questionStatusIcon(question: Question): string {
    if (this.isCorrect(question)) {
      return 'check';
    }
    if (this.isIncorrect(question)) {
      return 'close';
    }
    return 'remove';
  }

  questionStatusIconClasses(question: Question): string {
    if (this.isCorrect(question)) {
      return 'flex items-center justify-center w-6 h-6 rounded-full bg-success/10 text-success';
    }
    if (this.isIncorrect(question)) {
      return 'flex items-center justify-center w-6 h-6 rounded-full bg-error/10 text-error';
    }
    return 'flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400';
  }

  questionTitleClasses(question: Question): string {
    if (this.isCorrect(question)) {
      return 'text-sm font-semibold text-success';
    }
    if (this.isIncorrect(question)) {
      return 'text-sm font-semibold text-error';
    }
    return 'text-sm font-semibold text-slate-500 dark:text-slate-400';
  }

  optionRowClasses(question: Question, option: Option): string {
    const base = 'flex items-center px-3 py-3 rounded-lg border';
    const isSelected = this.isSelectedOption(question, option);
    const isCorrectOption = this.isCorrectOption(question, option);

    if (this.isIncorrect(question)) {
      if (isSelected) {
        return `${base} border-error bg-error/5 relative overflow-hidden justify-between`;
      }
      if (isCorrectOption) {
        return `${base} border-success bg-success/5 relative overflow-hidden justify-between`;
      }
      return `${base} border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors`;
    }

    if (this.isCorrect(question)) {
      if (isCorrectOption) {
        return `${base} border-success bg-success/5 relative overflow-hidden justify-between`;
      }
      return `${base} border-slate-200 dark:border-slate-700 opacity-60`;
    }

    if (isCorrectOption) {
      return `${base} border-primary/50 bg-slate-50 dark:bg-surface-highlight border-dashed justify-between`;
    }
    return `${base} border-slate-200 dark:border-slate-700 opacity-60`;
  }

  optionIndicatorClasses(question: Question, option: Option): string {
    const isSelected = this.isSelectedOption(question, option);
    const isCorrectOption = this.isCorrectOption(question, option);

    if (this.isIncorrect(question) && isSelected) {
      return 'w-5 h-5 rounded-full border-2 border-error flex items-center justify-center';
    }
    if (this.isIncorrect(question) && isCorrectOption) {
      return 'w-5 h-5 rounded-full border-2 border-success flex items-center justify-center';
    }
    if (this.isCorrect(question) && isCorrectOption) {
      return 'w-5 h-5 rounded-full border-2 border-success flex items-center justify-center bg-success';
    }
    if (this.isUnanswered(question) && isCorrectOption) {
      return 'w-5 h-5 rounded-full border-2 border-primary/60 flex items-center justify-center';
    }
    return 'w-5 h-5 rounded-full border border-slate-300 dark:border-slate-600 flex items-center justify-center';
  }

  optionTextClasses(question: Question, option: Option): string {
    const isSelected = this.isSelectedOption(question, option);
    const isCorrectOption = this.isCorrectOption(question, option);

    if (this.isIncorrect(question) && isSelected) {
      return 'text-sm font-medium text-error';
    }
    if ((this.isIncorrect(question) || this.isCorrect(question)) && isCorrectOption) {
      return 'text-sm font-medium text-slate-800 dark:text-slate-100';
    }
    if (this.isUnanswered(question) && isCorrectOption) {
      return 'text-sm font-medium text-slate-800 dark:text-slate-200';
    }
    if (this.isCorrect(question) || this.isUnanswered(question)) {
      return 'text-sm font-medium text-slate-500 dark:text-slate-500';
    }
    return 'text-sm font-medium text-slate-600 dark:text-slate-400';
  }

  optionMarker(question: Question, option: Option): string | null {
    const isSelected = this.isSelectedOption(question, option);
    const isCorrectOption = this.isCorrectOption(question, option);

    if (this.isIncorrect(question) && isSelected) {
      return 'close';
    }
    if ((this.isIncorrect(question) || this.isCorrect(question)) && isCorrectOption) {
      return 'Correct';
    }
    if (this.isUnanswered(question) && isCorrectOption) {
      return 'Answer';
    }
    return null;
  }

  async exportPdf(): Promise<void> {
    const html2canvas = window.html2canvas;
    const JsPDF = window.jspdf?.jsPDF;
    const container = this.resultsContainer?.nativeElement;

    if (!html2canvas || !JsPDF || !container) {
      this.exportError.set('PDF export libraries are not available.');
      return;
    }

    this.isExporting.set(true);
    this.exportError.set(null);

    try {
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#09090b',
      });

      const imageData = canvas.toDataURL('image/png');
      const pdf = new JsPDF('p', 'pt', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imageWidth = pdfWidth;
      const imageHeight = (canvas.height * imageWidth) / canvas.width;
      let heightLeft = imageHeight;
      let position = 0;

      pdf.addImage(imageData, 'PNG', 0, position, imageWidth, imageHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - imageHeight;
        pdf.addPage();
        pdf.addImage(imageData, 'PNG', 0, position, imageWidth, imageHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save('quiz-results.pdf');
    } catch {
      this.exportError.set('Failed to generate PDF.');
    } finally {
      this.isExporting.set(false);
    }
  }

  backToSetup(): void {
    this.quizService.resetQuiz();
    void this.router.navigate(['/']);
  }
}
