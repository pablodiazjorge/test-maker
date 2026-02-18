import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DEFAULT_QUIZ_CONFIG } from '../../core/data/quiz.data';
import { QuizService } from '../../core/services/quiz.service';

@Component({
  selector: 'app-quiz-config',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './quiz-config.component.html',
})
export class QuizConfigComponent {
  private readonly quizService = inject(QuizService);
  private readonly router = inject(Router);

  readonly topics = this.quizService.topics;

  questionCount = DEFAULT_QUIZ_CONFIG.questionCount;
  shuffleQuestions = DEFAULT_QUIZ_CONFIG.shuffleQuestions;
  shuffleAnswers = DEFAULT_QUIZ_CONFIG.shuffleAnswers;
  selectedTopicIds = [...DEFAULT_QUIZ_CONFIG.selectedTopicIds];
  showTopicValidationError = false;

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
  }

  startQuiz(): void {
    if (!this.selectedTopicIds.length) {
      this.showTopicValidationError = true;
      return;
    }

    this.quizService.startQuiz({
      questionCount: this.questionCount,
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
}
