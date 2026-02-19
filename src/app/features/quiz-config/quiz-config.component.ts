import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DEFAULT_QUIZ_CONFIG } from '../../core/data/quiz.data';
import { QuizService } from '../../core/services/quiz.service';
import { ThemeService } from '../../core/services/theme.service';
import { injectAuthStore } from '../../core/state/auth.store';

@Component({
  selector: 'app-quiz-config',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './quiz-config.component.html',
})
export class QuizConfigComponent implements OnInit {
  private readonly quizService = inject(QuizService);
  private readonly router = inject(Router);
  private readonly themeService = inject(ThemeService);
  private readonly authStore = injectAuthStore();
  private readonly hasHoverCapability =
    typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  get topics() {
    return this.quizService.topics;
  }

  get isDarkTheme(): boolean {
    return this.themeService.isDark();
  }

  questionCount = DEFAULT_QUIZ_CONFIG.questionCount;
  shuffleQuestions = DEFAULT_QUIZ_CONFIG.shuffleQuestions;
  shuffleAnswers = DEFAULT_QUIZ_CONFIG.shuffleAnswers;
  selectedTopicIds = [...DEFAULT_QUIZ_CONFIG.selectedTopicIds];
  showTopicValidationError = false;
  hasSelection = true;

  get selectedQuestionsPoolSize(): number {
    return this.quizService.getQuestionCountForTopics(this.selectedTopicIds);
  }

  get maxQuestionCount(): number {
    return this.selectedQuestionsPoolSize;
  }

  get middleQuestionCount(): number {
    return this.maxQuestionCount > 0 ? Math.ceil(this.maxQuestionCount / 2) : 0;
  }

  ngOnInit(): void {
    const availableTopicIds = new Set(this.topics.map((topic) => topic.id));
    this.selectedTopicIds = this.selectedTopicIds.filter((topicId) => availableTopicIds.has(topicId));

    if (!this.selectedTopicIds.length && this.topics.length) {
      this.selectedTopicIds = [this.topics[0].id];
    }

    this.questionCount = this.maxQuestionCount;
    this.syncQuestionCountWithSelection();
  }

  isTopicSelected(topicId: string): boolean {
    return this.selectedTopicIds.includes(topicId);
  }

  toggleTopic(topicId: string, event?: Event): void {
    if (this.isTopicSelected(topicId)) {
      this.selectedTopicIds = this.selectedTopicIds.filter((id) => id !== topicId);
    } else {
      this.selectedTopicIds = [...this.selectedTopicIds, topicId];
    }
    this.showTopicValidationError = false;

    if (this.selectedTopicIds.length > 0) {
      this.questionCount = this.maxQuestionCount;
    }

    this.syncQuestionCountWithSelection();
    if (event instanceof MouseEvent && event.detail > 0) {
      const target = event.currentTarget;
      if (target instanceof HTMLElement) {
        target.blur();
      }
    }
  }

  startQuiz(): void {
    if (!this.selectedTopicIds.length) {
      this.showTopicValidationError = true;
      return;
    }

    this.quizService.startQuiz({
      questionCount: Math.min(this.questionCount, this.maxQuestionCount),
      shuffleQuestions: this.shuffleQuestions,
      shuffleAnswers: this.shuffleAnswers,
      selectedTopicIds: this.selectedTopicIds,
    });

    void this.router.navigate(['/quiz']);
  }

  topicButtonClasses(topicId: string): string {
    if (this.isTopicSelected(topicId)) {
      return 'flex items-center justify-between w-full p-4 bg-white dark:bg-card-dark border border-primary dark:border-primary rounded-xl ring-1 ring-primary/20 transition-all text-left shadow-md shadow-primary/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30';
    }
    const hoverClasses = this.hasHoverCapability ? 'group hover:border-primary/50 dark:hover:border-primary/50' : '';
    return `flex items-center justify-between w-full p-4 bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-xl transition-all text-left shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${hoverClasses}`.trim();
  }

  topicNameClasses(topicId: string): string {
    if (this.isTopicSelected(topicId)) {
      return 'block text-sm font-semibold text-slate-900 dark:text-white text-primary';
    }
    const hoverClasses = this.hasHoverCapability ? 'group-hover:text-primary transition-colors' : '';
    return `block text-sm font-semibold text-slate-900 dark:text-white ${hoverClasses}`.trim();
  }

  topicIndicatorClasses(topicId: string): string {
    if (this.isTopicSelected(topicId)) {
      return 'w-5 h-5 rounded-full border-2 border-primary flex items-center justify-center bg-primary/10';
    }
    const hoverClasses = this.hasHoverCapability ? 'group-hover:border-primary group-hover:bg-primary/10' : '';
    return `w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center ${hoverClasses}`.trim();
  }

  onQuestionCountChange(value: number | string): void {
    if (!this.hasSelection) {
      this.questionCount = 0;
      return;
    }

    const nextValue = Number(value);
    if (Number.isNaN(nextValue)) {
      this.questionCount = 1;
      return;
    }

    this.questionCount = Math.max(1, Math.min(nextValue, this.maxQuestionCount));
  }

  onQuestionCountInput(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    if (!input) {
      return;
    }

    if (!this.hasSelection) {
      this.questionCount = 0;
      input.value = '0';
      return;
    }

    const parsedValue = Number(input.value);
    if (Number.isNaN(parsedValue)) {
      this.questionCount = 1;
      input.value = '1';
      return;
    }

    const clampedValue = Math.max(1, Math.min(Math.floor(parsedValue), this.maxQuestionCount));
    this.questionCount = clampedValue;

    if (input.value !== String(clampedValue)) {
      input.value = String(clampedValue);
    }
  }

  onQuestionCountBlur(): void {
    if (!this.hasSelection) {
      this.questionCount = 0;
      return;
    }
    this.questionCount = Math.max(1, Math.min(Math.floor(this.questionCount || 1), this.maxQuestionCount));
  }

  blockInvalidNumberInput(event: KeyboardEvent): void {
    const invalidKeys = ['e', 'E', '+', '-', '.', ','];
    if (invalidKeys.includes(event.key)) {
      event.preventDefault();
    }
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  async logout(): Promise<void> {
    const currentSession = this.authStore.session();
    this.authStore.logout();
    if (currentSession?.userId) {
      this.quizService.clearMasterData({ userId: currentSession.userId });
    } else {
      this.quizService.clearMasterData();
    }
    this.quizService.resetQuiz();
    await this.router.navigate(['/']);
  }

  private syncQuestionCountWithSelection(): void {
    this.hasSelection = this.selectedTopicIds.length > 0;
    if (!this.hasSelection) {
      this.questionCount = 0;
      return;
    }
    this.questionCount = Math.max(1, Math.min(this.questionCount, this.maxQuestionCount));
  }
}

