import { computed, Injectable, signal } from '@angular/core';
import { DEFAULT_QUIZ_CONFIG, Option, Question, QUESTIONS, QuizConfig, TOPICS, Topic } from '../data/quiz.data';

export interface QuizResults {
  total: number;
  answered: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  scorePercent: number;
  byTopic: Array<{
    topicId: string;
    topicName: string;
    total: number;
    correct: number;
    incorrect: number;
    unanswered: number;
  }>;
}

@Injectable({ providedIn: 'root' })
export class QuizService {
  readonly topics: readonly Topic[] = TOPICS;

  private readonly allQuestions: readonly Question[] = QUESTIONS;

  private readonly _config = signal<QuizConfig>({ ...DEFAULT_QUIZ_CONFIG });
  private readonly _questions = signal<Question[]>([]);
  private readonly _currentIndex = signal(0);

  readonly config = computed(() => this._config());
  readonly questions = computed(() => this._questions());
  readonly currentIndex = computed(() => this._currentIndex());
  readonly totalQuestions = computed(() => this._questions().length);

  readonly currentQuestion = computed(() => {
    const questions = this._questions();
    const index = this._currentIndex();
    if (!questions.length || index < 0 || index >= questions.length) {
      return null;
    }
    return questions[index];
  });

  readonly progress = computed(() => {
    const total = this._questions().length;
    if (!total) {
      return 0;
    }
    return Math.round(((this._currentIndex() + 1) / total) * 100);
  });

  readonly results = computed<QuizResults>(() => {
    const questions = this._questions();
    let correct = 0;
    let incorrect = 0;
    let unanswered = 0;
    const topicStats = new Map<
      string,
      { topicId: string; topicName: string; total: number; correct: number; incorrect: number; unanswered: number }
    >();

    for (const question of questions) {
      const existing =
        topicStats.get(question.topicId) ??
        {
          topicId: question.topicId,
          topicName: this.topicNameById(question.topicId),
          total: 0,
          correct: 0,
          incorrect: 0,
          unanswered: 0,
        };

      const mutable = {
        ...existing,
        total: existing.total + 1,
      };

      if (!question.userSelectedOptionId) {
        unanswered += 1;
        mutable.unanswered += 1;
      } else if (question.userSelectedOptionId === question.correctOptionId) {
        correct += 1;
        mutable.correct += 1;
      } else {
        incorrect += 1;
        mutable.incorrect += 1;
      }

      topicStats.set(question.topicId, mutable);
    }

    const total = questions.length;
    return {
      total,
      answered: correct + incorrect,
      correct,
      incorrect,
      unanswered,
      scorePercent: total ? Math.round((correct / total) * 100) : 0,
      byTopic: [...topicStats.values()],
    };
  });

  startQuiz(config: QuizConfig): void {
    const sanitizedConfig: QuizConfig = {
      questionCount: Math.max(1, config.questionCount),
      shuffleQuestions: config.shuffleQuestions,
      shuffleAnswers: config.shuffleAnswers,
      selectedTopicIds: [...new Set(config.selectedTopicIds)],
    };

    const selectedQuestions = this.allQuestions
      .filter((question) => sanitizedConfig.selectedTopicIds.includes(question.topicId))
      .map((question) => ({
        ...question,
        options: question.options.map((option) => ({ ...option })),
        userSelectedOptionId: null,
      }));

    const maybeShuffledQuestions = sanitizedConfig.shuffleQuestions
      ? this.shuffleArray(selectedQuestions)
      : [...selectedQuestions];

    const withRandomizedOptions = maybeShuffledQuestions.map((question) => ({
      ...question,
      options: sanitizedConfig.shuffleAnswers ? this.randomizeOptions(question.options) : [...question.options],
    }));

    const activeQuestions = withRandomizedOptions.slice(0, sanitizedConfig.questionCount);

    this._config.set(sanitizedConfig);
    this._questions.set(activeQuestions);
    this._currentIndex.set(0);
  }

  resetQuiz(): void {
    this._questions.set([]);
    this._currentIndex.set(0);
    this._config.set({ ...DEFAULT_QUIZ_CONFIG });
  }

  selectAnswer(questionId: string, optionId: string): void {
    this._questions.update((questions) =>
      questions.map((question) => {
        if (question.id !== questionId) {
          return question;
        }

        const optionExists = question.options.some((option) => option.id === optionId);
        if (!optionExists) {
          return question;
        }

        return {
          ...question,
          userSelectedOptionId: optionId,
        };
      }),
    );
  }

  goToQuestion(index: number): void {
    const total = this._questions().length;
    if (!total) {
      this._currentIndex.set(0);
      return;
    }
    const boundedIndex = Math.max(0, Math.min(index, total - 1));
    this._currentIndex.set(boundedIndex);
  }

  nextQuestion(): void {
    this.goToQuestion(this._currentIndex() + 1);
  }

  previousQuestion(): void {
    this.goToQuestion(this._currentIndex() - 1);
  }

  randomizeOptions(options: Option[]): Option[] {
    return this.shuffleArray(options);
  }

  private shuffleArray<T>(items: readonly T[]): T[] {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const randomIndex = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[i]];
    }
    return shuffled;
  }

  private topicNameById(topicId: string): string {
    return this.topics.find((topic) => topic.id === topicId)?.name ?? topicId;
  }
}
