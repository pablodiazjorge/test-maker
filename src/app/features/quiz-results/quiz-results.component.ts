import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Option, Question } from '../../core/data/quiz.data';
import { I18nService } from '../../core/services/i18n.service';
import { QuizService } from '../../core/services/quiz.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

type ResultsFilter = 'all' | 'incorrect' | 'unanswered';

interface JsPdfInstance {
  internal: {
    pageSize: {
      getWidth(): number;
      getHeight(): number;
    };
  };
  setFont(fontName: string, fontStyle?: 'normal' | 'bold' | 'italic' | 'bolditalic'): void;
  setFontSize(size: number): void;
  setTextColor(red: number, green: number, blue: number): void;
  setDrawColor(red: number, green: number, blue: number): void;
  setFillColor(red: number, green: number, blue: number): void;
  rect(x: number, y: number, width: number, height: number, style?: 'S' | 'F' | 'FD' | 'DF'): void;
  text(text: string | string[], x: number, y: number): void;
  splitTextToSize(text: string, maxWidth: number): string[];
  line(x1: number, y1: number, x2: number, y2: number): void;
  addPage(): void;
  save(fileName: string): void;
}

interface JsPdfConstructor {
  new (orientation: 'p', unit: 'pt', format: 'a4'): JsPdfInstance;
}

declare global {
  interface Window {
    jspdf?: {
      jsPDF?: JsPdfConstructor;
    };
  }
}

@Component({
  selector: 'app-quiz-results',
  standalone: true,
  imports: [EmptyStateComponent, TranslateModule],
  templateUrl: './quiz-results.component.html',
})
export class QuizResultsComponent {
  private readonly i18n = inject(I18nService);
  private readonly quizService = inject(QuizService);
  private readonly router = inject(Router);

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
      return 'w-5 h-5 shrink-0 rounded-full border-2 border-error flex items-center justify-center';
    }
    if (this.isIncorrect(question) && isCorrectOption) {
      return 'w-5 h-5 shrink-0 rounded-full border-2 border-success flex items-center justify-center';
    }
    if (this.isCorrect(question) && isCorrectOption) {
      return 'w-5 h-5 shrink-0 rounded-full border-2 border-success flex items-center justify-center bg-success';
    }
    if (this.isUnanswered(question) && isCorrectOption) {
      return 'w-5 h-5 shrink-0 rounded-full border-2 border-primary/60 flex items-center justify-center';
    }
    return 'w-5 h-5 shrink-0 rounded-full border border-slate-300 dark:border-slate-600 flex items-center justify-center';
  }

  optionTextClasses(question: Question, option: Option): string {
    const base = 'min-w-0 break-words leading-snug';
    const isSelected = this.isSelectedOption(question, option);
    const isCorrectOption = this.isCorrectOption(question, option);

    if (this.isIncorrect(question) && isSelected) {
      return `${base} text-sm font-medium text-error`;
    }
    if ((this.isIncorrect(question) || this.isCorrect(question)) && isCorrectOption) {
      return `${base} text-sm font-medium text-slate-800 dark:text-slate-100`;
    }
    if (this.isUnanswered(question) && isCorrectOption) {
      return `${base} text-sm font-medium text-slate-800 dark:text-slate-200`;
    }
    if (this.isCorrect(question) || this.isUnanswered(question)) {
      return `${base} text-sm font-medium text-slate-500 dark:text-slate-500`;
    }
    return `${base} text-sm font-medium text-slate-600 dark:text-slate-400`;
  }

  optionMarker(question: Question, option: Option): string | null {
    const isSelected = this.isSelectedOption(question, option);
    const isCorrectOption = this.isCorrectOption(question, option);

    if (this.isIncorrect(question) && isSelected) {
      return 'close';
    }
    if ((this.isIncorrect(question) || this.isCorrect(question)) && isCorrectOption) {
      return 'correct';
    }
    if (this.isUnanswered(question) && isCorrectOption) {
      return 'answer';
    }
    return null;
  }

  async exportPdf(): Promise<void> {
    const JsPDF = window.jspdf?.jsPDF;
    if (!JsPDF) {
      this.exportError.set(this.i18n.t('errors.pdf_lib_unavailable'));
      return;
    }

    this.isExporting.set(true);
    this.exportError.set(null);

    try {
      const pdf = new JsPDF('p', 'pt', 'a4');
      const margin = 40;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const contentWidth = pageWidth - margin * 2;
      const lineHeight = 15;
      const exportedQuestions = this.filteredQuestions();
      let y = 52;

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(20);
      pdf.setTextColor(15, 23, 42);
      pdf.text(this.i18n.t('pdf.report_title'), margin, y);
      y += 24;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(100, 116, 139);
      pdf.text(this.i18n.t('pdf.generated', { value: new Date().toLocaleString() }), margin, y);
      y += 14;
      pdf.text(this.i18n.t('pdf.filter', { value: this.exportFilterLabel() }), margin, y);
      y += 20;

      const summary = this.results();
      const summaryHeight = 74;
      if (y + summaryHeight > pageHeight - margin) {
        pdf.addPage();
        y = margin;
      }
      pdf.setFillColor(248, 250, 252);
      pdf.setDrawColor(226, 232, 240);
      pdf.rect(margin, y, contentWidth, summaryHeight, 'FD');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(15, 23, 42);
      pdf.text(
        this.i18n.t('pdf.score', { correct: summary.correct, total: summary.total, percent: summary.scorePercent }),
        margin + 12,
        y + 20,
      );

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      pdf.setTextColor(51, 65, 85);
      pdf.text(this.i18n.t('pdf.answered', { value: summary.answered }), margin + 12, y + 40);
      pdf.text(this.i18n.t('pdf.correct', { value: summary.correct }), margin + 126, y + 40);
      pdf.text(this.i18n.t('pdf.incorrect', { value: summary.incorrect }), margin + 220, y + 40);
      pdf.text(this.i18n.t('pdf.unanswered', { value: summary.unanswered }), margin + 330, y + 40);
      pdf.text(this.i18n.t('pdf.questions_exported', { value: exportedQuestions.length }), margin + 12, y + 58);
      y += summaryHeight + 18;

      for (const question of exportedQuestions) {
        const statusLabel = this.questionStatusLabel(question);
        const statusColor = this.questionStatusColor(question);
        const questionTitle = `${this.i18n.t('runner.question_label', {
          number: this.questionNumber(question.id),
        })} - ${this.topicName(question.topicId)}`;
        const questionLines = pdf.splitTextToSize(question.text, contentWidth);
        const optionGroups = question.options.map((option, index) => {
          const optionText = `${this.optionLetter(index)}) ${option.text}`;
          const markerText = this.optionPdfSuffix(question, option);
          return {
            option,
            lines: pdf.splitTextToSize(optionText, contentWidth - 12),
            markerText,
          };
        });
        const optionsHeight =
          lineHeight +
          optionGroups.reduce(
            (sum, group) => sum + group.lines.length * lineHeight + (group.markerText ? lineHeight : 0) + 4,
            0,
          );
        const estimatedHeight = 34 + questionLines.length * lineHeight + 8 + optionsHeight + 14;

        if (y + estimatedHeight > pageHeight - margin) {
          pdf.addPage();
          y = margin;
        }

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.setTextColor(15, 23, 42);
        pdf.text(questionTitle, margin, y);
        y += 18;

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
        pdf.text(statusLabel, margin, y);
        y += 14;

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(11);
        pdf.setTextColor(30, 41, 59);
        pdf.text(questionLines, margin, y);
        y += questionLines.length * lineHeight + 4;

        pdf.setFontSize(10);
        pdf.setTextColor(100, 116, 139);
        pdf.text(this.i18n.t('pdf.options_label'), margin, y);
        y += lineHeight;

        for (const group of optionGroups) {
          pdf.setTextColor(51, 65, 85);
          pdf.text(group.lines, margin + 12, y);
          y += group.lines.length * lineHeight + 2;

          if (group.markerText) {
            const markerColor = this.optionPdfColor(question, group.option);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(markerColor[0], markerColor[1], markerColor[2]);
            pdf.text(group.markerText.trim(), margin + 20, y);
            y += lineHeight;
            pdf.setFont('helvetica', 'normal');
          }

          y += 2;
        }

        pdf.setDrawColor(226, 232, 240);
        pdf.line(margin, y, pageWidth - margin, y);
        y += 14;
      }

      pdf.save(this.buildPdfFileName());
    } catch {
      this.exportError.set(this.i18n.t('errors.pdf_generate_failed'));
    } finally {
      this.isExporting.set(false);
    }
  }

  backToSetup(): void {
    this.quizService.resetQuiz();
    void this.router.navigate(['/config']);
  }

  private exportFilterLabel(): string {
    if (this.filter() === 'incorrect') {
      return this.i18n.t('actions.incorrect');
    }
    if (this.filter() === 'unanswered') {
      return this.i18n.t('actions.unanswered');
    }
    return this.i18n.t('actions.all');
  }

  private buildPdfFileName(): string {
    const now = new Date();
    const locale = this.i18n.language() === 'es' ? 'es-ES' : 'en-US';
    const dayName = this.normalizeFileNamePart(new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(now));
    const datePart = `${this.padDatePart(now.getDate())}-${this.padDatePart(now.getMonth() + 1)}-${now.getFullYear()}`;
    const timePart = `${this.padDatePart(now.getHours())}${this.padDatePart(now.getMinutes())}${this.padDatePart(now.getSeconds())}`;
    const milliPart = now.getMilliseconds().toString().padStart(3, '0');
    const randomPart = Math.random().toString(36).slice(2, 8);

    return `${this.i18n.t('pdf.file_prefix')}-${dayName}-${datePart}-${timePart}-${milliPart}-${randomPart}.pdf`;
  }

  private padDatePart(value: number): string {
    return value.toString().padStart(2, '0');
  }

  private questionStatusLabel(question: Question): string {
    if (this.isCorrect(question)) {
      return this.i18n.t('status.correct');
    }
    if (this.isIncorrect(question)) {
      return this.i18n.t('status.incorrect');
    }
    return this.i18n.t('status.unanswered');
  }

  private questionStatusColor(question: Question): [number, number, number] {
    if (this.isCorrect(question)) {
      return [5, 150, 105];
    }
    if (this.isIncorrect(question)) {
      return [220, 38, 38];
    }
    return [100, 116, 139];
  }

  private optionTextById(question: Question, optionId: string | null | undefined): string | null {
    if (!optionId) {
      return null;
    }
    return question.options.find((option) => option.id === optionId)?.text ?? null;
  }

  private optionLetter(index: number): string {
    return String.fromCharCode(97 + index);
  }

  private optionPdfSuffix(question: Question, option: Option): string {
    const isSelected = this.isSelectedOption(question, option);
    const isCorrect = this.isCorrectOption(question, option);
    if (isSelected && isCorrect) {
      return this.i18n.t('pdf.your_answer_correct');
    }
    if (isSelected) {
      return this.i18n.t('pdf.your_answer');
    }
    if (isCorrect) {
      return this.i18n.t('pdf.correct_suffix');
    }
    return '';
  }

  private normalizeFileNamePart(input: string): string {
    return input
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .toLowerCase();
  }

  private optionPdfColor(question: Question, option: Option): [number, number, number] {
    const isSelected = this.isSelectedOption(question, option);
    const isCorrect = this.isCorrectOption(question, option);
    if (isSelected && !isCorrect) {
      return [220, 38, 38];
    }
    if (isCorrect) {
      return [5, 150, 105];
    }
    return [51, 65, 85];
  }
}
