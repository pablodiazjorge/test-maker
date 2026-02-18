import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DEFAULT_QUIZ_CONFIG } from '../../core/data/quiz.data';
import { QuizService } from '../../core/services/quiz.service';
import { ThemeService } from '../../core/services/theme.service';

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
    return Math.max(1, this.selectedQuestionsPoolSize);
  }

  get middleQuestionCount(): number {
    return Math.max(1, Math.ceil(this.maxQuestionCount / 2));
  }

  ngOnInit(): void {
    const availableTopicIds = new Set(this.topics.map((topic) => topic.id));
    this.selectedTopicIds = this.selectedTopicIds.filter((topicId) => availableTopicIds.has(topicId));

    if (!this.selectedTopicIds.length && this.topics.length) {
      this.selectedTopicIds = [this.topics[0].id];
    }

    this.syncQuestionCountWithSelection();
  }

  isTopicSelected(topicId: string): boolean {
    return this.selectedTopicIds.includes(topicId);
  }

  toggleTopic(topicId: string): void {
    if (this.isTopicSelected(topicId)) {
      this.selectedTopicIds = this.selectedTopicIds.filter((id) => id !== topicId);
    } else {
      this.selectedTopicIds = [...this.selectedTopicIds, topicId];
    }
    this.showTopicValidationError = false;
    this.syncQuestionCountWithSelection();
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
      return 'flex items-center justify-between w-full p-4 bg-white dark:bg-card-dark border border-primary dark:border-primary rounded-xl ring-1 ring-primary/20 transition-all text-left shadow-md shadow-primary/5';
    }
    return 'flex items-center justify-between w-full p-4 bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-xl hover:border-primary/50 dark:hover:border-primary/50 transition-all group text-left shadow-sm';
  }

  topicNameClasses(topicId: string): string {
    if (this.isTopicSelected(topicId)) {
      return 'block text-sm font-semibold text-slate-900 dark:text-white text-primary';
    }
    return 'block text-sm font-semibold text-slate-900 dark:text-white group-hover:text-primary transition-colors';
  }

  topicIndicatorClasses(topicId: string): string {
    if (this.isTopicSelected(topicId)) {
      return 'w-5 h-5 rounded-full border-2 border-primary flex items-center justify-center bg-primary/10';
    }
    return 'w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600 group-hover:border-primary group-hover:bg-primary/10 flex items-center justify-center';
  }

  onQuestionCountChange(value: number | string): void {
    const nextValue = Number(value);
    if (Number.isNaN(nextValue)) {
      this.questionCount = 1;
      return;
    }

    this.questionCount = Math.max(1, Math.min(nextValue, this.maxQuestionCount));
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  private syncQuestionCountWithSelection(): void {
    this.hasSelection = this.selectedTopicIds.length > 0;
    this.questionCount = Math.max(1, Math.min(this.questionCount, this.maxQuestionCount));
  }
}
