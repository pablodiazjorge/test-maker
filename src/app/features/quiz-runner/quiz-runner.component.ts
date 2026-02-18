import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Option, Question } from '../../core/data/quiz.data';
import { QuizService } from '../../core/services/quiz.service';

@Component({
  selector: 'app-quiz-runner',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './quiz-runner.component.html',
})
export class QuizRunnerComponent {
  private readonly quizService = inject(QuizService);
  private readonly router = inject(Router);

  readonly questions = this.quizService.questions;
  readonly currentQuestion = this.quizService.currentQuestion;
  readonly currentIndex = this.quizService.currentIndex;
  readonly totalQuestions = this.quizService.totalQuestions;
  readonly progress = this.quizService.progress;
  readonly isLastQuestion = computed(() => {
    const total = this.totalQuestions();
    return total > 0 && this.currentIndex() === total - 1;
  });

  selectAnswer(questionId: string, optionId: string): void {
    this.quizService.selectAnswer(questionId, optionId);
  }

  goToQuestion(value: number | string): void {
    const questionNumber = Number(value);
    if (Number.isNaN(questionNumber)) {
      return;
    }
    this.quizService.goToQuestion(questionNumber - 1);
  }

  goBack(): void {
    this.quizService.previousQuestion();
  }

  continueQuiz(): void {
    if (this.isLastQuestion()) {
      void this.router.navigate(['/results']);
      return;
    }
    this.quizService.nextQuestion();
  }

  finishQuiz(): void {
    void this.router.navigate(['/results']);
  }

  restart(): void {
    this.quizService.resetQuiz();
    void this.router.navigate(['/']);
  }

  optionLabel(index: number): string {
    return String.fromCharCode(65 + index);
  }

  optionButtonClasses(question: Question, option: Option): string {
    const isSelected = question.userSelectedOptionId === option.id;
    if (isSelected) {
      return 'group relative flex w-full items-center p-5 text-left transition-all duration-200 border-2 border-primary bg-primary/5 rounded-2xl active:scale-[0.98]';
    }
    return 'group relative flex w-full items-center p-5 text-left transition-all duration-200 border border-slate-200 dark:border-border-dark rounded-2xl bg-white dark:bg-card-dark hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-card-dark/80 active:scale-[0.98]';
  }

  optionBadgeClasses(question: Question, option: Option): string {
    const isSelected = question.userSelectedOptionId === option.id;
    if (isSelected) {
      return 'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white transition-colors shadow-sm';
    }
    return 'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-background-dark text-sm font-bold text-slate-600 dark:text-muted-foreground group-hover:text-primary transition-colors border border-slate-200 dark:border-border-dark/50';
  }

  optionTextClasses(question: Question, option: Option): string {
    const isSelected = question.userSelectedOptionId === option.id;
    return isSelected
      ? 'ml-5 text-base font-semibold text-slate-900 dark:text-white'
      : 'ml-5 text-base font-medium text-slate-800 dark:text-white/90 group-hover:text-slate-900 dark:group-hover:text-white';
  }
}
