import { computed, Injectable, signal } from '@angular/core';
import { DEFAULT_QUIZ_CONFIG, MasterTopic, Option, Question, QuizConfig, Topic } from '../data/quiz.data';
import { clearCacheValue, readCacheValue, writeCacheValue } from '../state/browser-cache';

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
  private static readonly MASTER_DATA_CACHE_KEY = 'test-maker.master-data.v1';

  private topicsData: Topic[] = [];
  private allQuestions: Question[] = [];
  private questionCountByTopicId = new Map<string, number>();

  private readonly _config = signal<QuizConfig>({ ...DEFAULT_QUIZ_CONFIG });
  private readonly _questions = signal<Question[]>([]);
  private readonly _currentIndex = signal(0);
  private readonly _isDataLoaded = signal(false);
  private readonly _isDataLoading = signal(false);
  private readonly _dataLoadError = signal<string | null>(null);

  constructor() {
    this.restoreMasterDataFromCache();
  }

  get topics(): readonly Topic[] {
    return this.topicsData;
  }

  readonly config = computed(() => this._config());
  readonly questions = computed(() => this._questions());
  readonly currentIndex = computed(() => this._currentIndex());
  readonly totalQuestions = computed(() => this._questions().length);
  readonly isDataLoaded = computed(() => this._isDataLoaded());
  readonly isDataLoading = computed(() => this._isDataLoading());
  readonly dataLoadError = computed(() => this._dataLoadError());

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

  setMasterData(masterTopics: MasterTopic[]): boolean {
    this._isDataLoading.set(true);
    this._dataLoadError.set(null);

    try {
      const { topics, questions } = this.normalizeMasterData(masterTopics);
      this.topicsData = topics;
      this.allQuestions = questions;
      this.questionCountByTopicId = this.buildQuestionCountByTopicId(questions);
      const hasQuestions = questions.length > 0;
      this._isDataLoaded.set(hasQuestions);
      if (!hasQuestions) {
        this._dataLoadError.set('Master data is empty or invalid.');
        clearCacheValue(QuizService.MASTER_DATA_CACHE_KEY);
      } else {
        writeCacheValue(QuizService.MASTER_DATA_CACHE_KEY, masterTopics);
      }
      return hasQuestions;
    } catch {
      this.clearMasterData();
      this._dataLoadError.set('Unable to load quiz data.');
      clearCacheValue(QuizService.MASTER_DATA_CACHE_KEY);
      return false;
    } finally {
      this._isDataLoading.set(false);
    }
  }

  clearMasterData(): void {
    this.topicsData = [];
    this.allQuestions = [];
    this.questionCountByTopicId = new Map<string, number>();
    this._questions.set([]);
    this._currentIndex.set(0);
    this._isDataLoaded.set(false);
    this._isDataLoading.set(false);
    this._dataLoadError.set(null);
    clearCacheValue(QuizService.MASTER_DATA_CACHE_KEY);
  }

  startQuiz(config: QuizConfig): void {
    if (!this._isDataLoaded() || !this.allQuestions.length) {
      this._questions.set([]);
      this._currentIndex.set(0);
      return;
    }

    const validTopicIds = new Set(this.topicsData.map((topic) => topic.id));
    const selectedTopicIds = [...new Set(config.selectedTopicIds)].filter((topicId) => validTopicIds.has(topicId));
    const questionPool = this.getQuestionPoolByTopics(selectedTopicIds);

    if (!questionPool.length) {
      this._config.set({
        questionCount: 0,
        shuffleQuestions: config.shuffleQuestions,
        shuffleAnswers: config.shuffleAnswers,
        selectedTopicIds,
      });
      this._questions.set([]);
      this._currentIndex.set(0);
      return;
    }

    const questionCount = Math.min(Math.max(1, Math.floor(config.questionCount)), questionPool.length);

    const sanitizedConfig: QuizConfig = {
      questionCount,
      shuffleQuestions: config.shuffleQuestions,
      shuffleAnswers: config.shuffleAnswers,
      selectedTopicIds,
    };

    const questionsForSession = sanitizedConfig.shuffleQuestions
      ? this.shuffleArray(questionPool).slice(0, sanitizedConfig.questionCount)
      : questionPool.slice(0, sanitizedConfig.questionCount);

    const withRandomizedOptions = questionsForSession.map((question) => ({
      ...question,
      options: sanitizedConfig.shuffleAnswers ? this.randomizeOptions(question.options) : [...question.options],
    }));

    this._config.set(sanitizedConfig);
    this._questions.set(withRandomizedOptions);
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

  getQuestionCountForTopic(topicId: string): number {
    return this.questionCountByTopicId.get(topicId) ?? 0;
  }

  getQuestionCountForTopics(topicIds: readonly string[]): number {
    return topicIds.reduce((total, topicId) => total + this.getQuestionCountForTopic(topicId), 0);
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

  private getQuestionPoolByTopics(topicIds: readonly string[]): Question[] {
    const topicIdSet = new Set(topicIds);
    return this.allQuestions
      .filter((question) => topicIdSet.has(question.topicId))
      .map((question) => ({
        ...question,
        options: question.options.map((option) => ({ ...option })),
        userSelectedOptionId: null,
      }));
  }

  private buildQuestionCountByTopicId(questions: readonly Question[]): Map<string, number> {
    const map = new Map<string, number>();
    for (const question of questions) {
      map.set(question.topicId, (map.get(question.topicId) ?? 0) + 1);
    }
    return map;
  }

  private normalizeMasterData(masterTopics: MasterTopic[]): { topics: Topic[]; questions: Question[] } {
    if (!Array.isArray(masterTopics)) {
      return { topics: [], questions: [] };
    }

    const topics: Topic[] = [];
    const questions: Question[] = [];

    for (const topic of masterTopics) {
      if (!topic || typeof topic.id !== 'string' || typeof topic.name !== 'string') {
        continue;
      }

      topics.push({
        id: topic.id,
        name: topic.name,
        description: typeof topic.description === 'string' ? topic.description : '',
      });

      if (!Array.isArray(topic.questions)) {
        continue;
      }

      for (const question of topic.questions) {
        const questionText = typeof question.text === 'string' ? question.text : question.questionText;
        if (!question || typeof question.id !== 'string' || typeof questionText !== 'string') {
          continue;
        }

        if (!Array.isArray(question.options) || !question.options.length) {
          continue;
        }

        const options = question.options
          .filter((option) => option && typeof option.id === 'string' && typeof option.text === 'string')
          .map((option) => ({
            id: option.id,
            text: option.text,
          }));

        if (!options.length) {
          continue;
        }

        const isValidCorrectOption = options.some((option) => option.id === question.correctOptionId);
        if (!isValidCorrectOption) {
          continue;
        }

        questions.push({
          id: question.id,
          topicId: topic.id,
          text: questionText,
          options,
          correctOptionId: question.correctOptionId,
          userSelectedOptionId: null,
        });
      }
    }

    return { topics, questions };
  }

  private restoreMasterDataFromCache(): void {
    const cachedMasterData = readCacheValue<MasterTopic[]>(QuizService.MASTER_DATA_CACHE_KEY);
    if (!cachedMasterData) {
      return;
    }
    this.setMasterData(cachedMasterData);
  }
}
