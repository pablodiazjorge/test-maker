import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { DEFAULT_QUIZ_CONFIG } from '../../core/data/quiz.data';
import { QuizService } from '../../core/services/quiz.service';
import { injectAuthStore } from '../../core/state/auth.store';
import { TopicGroupSelectorComponent } from '../../shared/components/topic-group-selector/topic-group-selector.component';
import { ThemeToggleButtonComponent } from '../../shared/components/theme-toggle-button/theme-toggle-button.component';

@Component({
  selector: 'app-quiz-config',
  standalone: true,
  imports: [FormsModule, ThemeToggleButtonComponent, TopicGroupSelectorComponent, TranslateModule],
  templateUrl: './quiz-config.component.html',
})
export class QuizConfigComponent implements OnInit {
  private readonly quizService = inject(QuizService);
  private readonly router = inject(Router);
  private readonly authStore = injectAuthStore();

  get topicGroups() {
    return this.quizService.topicGroups;
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
    const availableTopicIds = new Set(this.quizService.topics.map((topic) => topic.id));
    this.selectedTopicIds = this.selectedTopicIds.filter((topicId) => availableTopicIds.has(topicId));

    this.questionCount = this.maxQuestionCount;
    this.syncQuestionCountWithSelection();
  }

  onSelectedTopicIdsChange(topicIds: string[]): void {
    this.selectedTopicIds = topicIds;
    this.showTopicValidationError = false;

    if (this.selectedTopicIds.length > 0) {
      this.questionCount = this.maxQuestionCount;
    }

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

