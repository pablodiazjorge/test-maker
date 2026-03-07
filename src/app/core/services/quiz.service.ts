import { computed, Injectable, signal } from '@angular/core';
import { DEFAULT_QUIZ_CONFIG, MasterQuestion, MasterTopic, MasterTopicChild, Option, Question, QuizConfig, Topic, TopicGroup } from '../data/quiz.data';
import { clearCacheValue, readCacheValue, writeCacheValue } from '../state/browser-cache';

export interface QuizResults {
  total: number;
  answered: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  score: number;
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
  private static readonly MASTER_DATA_CACHE_KEY_PREFIX = 'test-maker.master-data';
  private static readonly NAME_COLLATOR = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

  private topicsData: Topic[] = [];
  private topicGroupsData: TopicGroup[] = [];
  private allQuestions: Question[] = [];
  private questionCountByTopicId = new Map<string, number>();
  private currentDataUserId: string | null = null;

  private readonly _config = signal<QuizConfig>({ ...DEFAULT_QUIZ_CONFIG });
  private readonly _questions = signal<Question[]>([]);
  private readonly _currentIndex = signal(0);
  private readonly _quizStartedAt = signal<number | null>(null);
  private readonly _quizFinishedAt = signal<number | null>(null);
  private readonly _isDataLoaded = signal(false);
  private readonly _isDataLoading = signal(false);
  private readonly _dataLoadError = signal<string | null>(null);

  get topics(): readonly Topic[] {
    return this.topicsData;
  }

  get topicGroups(): readonly TopicGroup[] {
    return this.topicGroupsData;
  }

  readonly config = computed(() => this._config());
  readonly questions = computed(() => this._questions());
  readonly currentIndex = computed(() => this._currentIndex());
  readonly quizStartedAt = computed(() => this._quizStartedAt());
  readonly quizFinishedAt = computed(() => this._quizFinishedAt());
  readonly totalQuestions = computed(() => this._questions().length);
  readonly isDataLoaded = computed(() => this._isDataLoaded());
  readonly isDataLoading = computed(() => this._isDataLoading());
  readonly dataLoadError = computed(() => this._dataLoadError());
  readonly elapsedSeconds = computed(() => this.getElapsedSeconds());
  readonly elapsedTime = computed(() => this.formatElapsedTime(this.elapsedSeconds()));

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
    const questionValue = total ? 10 / total : 0;
    const penaltyQuestions = Math.floor(incorrect / 3);
    const rawScore = (correct - penaltyQuestions) * questionValue;
    const score = total ? Number(Math.max(0, Math.min(10, rawScore)).toFixed(2)) : 0;

    return {
      total,
      answered: correct + incorrect,
      correct,
      incorrect,
      unanswered,
      score,
      byTopic: [...topicStats.values()],
    };
  });

  setMasterData(masterTopics: MasterTopic[], userId: string): boolean {
    this._isDataLoading.set(true);
    this._dataLoadError.set(null);
    const normalizedUserId = userId.trim();

    try {
      const { topics, topicGroups, questions } = this.normalizeMasterData(masterTopics);
      this.topicsData = topics;
      this.topicGroupsData = topicGroups;
      this.allQuestions = questions;
      this.questionCountByTopicId = this.buildQuestionCountByTopicId(questions);
      this.currentDataUserId = normalizedUserId;
      const hasQuestions = questions.length > 0;
      this._isDataLoaded.set(hasQuestions);
      if (!hasQuestions) {
        this._dataLoadError.set('Master data is empty or invalid.');
        clearCacheValue(this.buildMasterDataCacheKey(normalizedUserId));
      } else {
        writeCacheValue(this.buildMasterDataCacheKey(normalizedUserId), masterTopics);
      }
      return hasQuestions;
    } catch {
      this.clearMasterData({ userId: normalizedUserId });
      this._dataLoadError.set('Unable to load quiz data.');
      return false;
    } finally {
      this._isDataLoading.set(false);
    }
  }

  restoreMasterDataFromCache(userId: string): boolean {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return false;
    }

    const cachedMasterData = readCacheValue<MasterTopic[]>(this.buildMasterDataCacheKey(normalizedUserId));
    if (!cachedMasterData) {
      return false;
    }

    return this.setMasterData(cachedMasterData, normalizedUserId);
  }

  clearMasterData(options?: { userId?: string; clearCache?: boolean }): void {
    const normalizedUserId = options?.userId?.trim() || this.currentDataUserId || '';
    const clearCache = options?.clearCache ?? true;

    this.topicsData = [];
    this.topicGroupsData = [];
    this.allQuestions = [];
    this.questionCountByTopicId = new Map<string, number>();
    this._questions.set([]);
    this._currentIndex.set(0);
    this._quizStartedAt.set(null);
    this._quizFinishedAt.set(null);
    this._isDataLoaded.set(false);
    this._isDataLoading.set(false);
    this._dataLoadError.set(null);
    this.currentDataUserId = null;

    if (clearCache && normalizedUserId) {
      clearCacheValue(this.buildMasterDataCacheKey(normalizedUserId));
    }
  }

  startQuiz(config: QuizConfig): void {
    if (!this._isDataLoaded() || !this.allQuestions.length) {
      this._questions.set([]);
      this._currentIndex.set(0);
      this._quizStartedAt.set(null);
      this._quizFinishedAt.set(null);
      return;
    }

    const validTopicIds = new Set(this.topicsData.map((topic) => topic.id));
    const selectedTopicIds = [...new Set(config.selectedTopicIds)].filter((topicId) => validTopicIds.has(topicId));

    const totalAvailableQuestions = this.getQuestionCountForTopics(selectedTopicIds);
    const requestedQuestionCount = Math.min(Math.max(1, Math.floor(config.questionCount)), totalAvailableQuestions);

    const questionPool =
      requestedQuestionCount < totalAvailableQuestions
        ? this.getDistributedQuestionPool(selectedTopicIds, requestedQuestionCount)
        : this.getQuestionPoolByTopics(selectedTopicIds);

    if (!questionPool.length) {
      this._config.set({
        questionCount: 0,
        shuffleQuestions: config.shuffleQuestions,
        shuffleAnswers: config.shuffleAnswers,
        selectedTopicIds,
      });
      this._questions.set([]);
      this._currentIndex.set(0);
      this._quizStartedAt.set(null);
      this._quizFinishedAt.set(null);
      return;
    }

    const sanitizedConfig: QuizConfig = {
      questionCount: requestedQuestionCount,
      shuffleQuestions: config.shuffleQuestions,
      shuffleAnswers: config.shuffleAnswers,
      selectedTopicIds,
    };

    const questionsForSession = sanitizedConfig.shuffleQuestions
      ? this.shuffleArray(questionPool)
      : questionPool;

    const withRandomizedOptions = questionsForSession.map((question) => ({
      ...question,
      options: sanitizedConfig.shuffleAnswers ? this.randomizeOptions(question.options) : [...question.options],
    }));

    this._config.set(sanitizedConfig);
    this._questions.set(withRandomizedOptions);
    this._currentIndex.set(0);
    this._quizStartedAt.set(Date.now());
    this._quizFinishedAt.set(null);
  }

  resetQuiz(): void {
    this._questions.set([]);
    this._currentIndex.set(0);
    this._quizStartedAt.set(null);
    this._quizFinishedAt.set(null);
    this._config.set({ ...DEFAULT_QUIZ_CONFIG });
  }

  finishQuiz(): void {
    if (!this._questions().length || !this._quizStartedAt() || this._quizFinishedAt()) {
      return;
    }
    this._quizFinishedAt.set(Date.now());
  }

  getElapsedSeconds(atTimestamp = Date.now()): number {
    const startedAt = this._quizStartedAt();
    if (!startedAt) {
      return 0;
    }

    const finishedAt = this._quizFinishedAt();
    const endTimestamp = finishedAt ?? atTimestamp;
    return Math.max(0, Math.floor((endTimestamp - startedAt) / 1000));
  }

  formatElapsedTime(totalSeconds: number): string {
    const normalizedSeconds = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(normalizedSeconds / 3600);
    const minutes = Math.floor((normalizedSeconds % 3600) / 60);
    const seconds = normalizedSeconds % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
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

  private getDistributedQuestionPool(topicIds: readonly string[], questionCount: number): Question[] {
    const questions: Question[] = [];
    const topicsWithQuestions = topicIds
      .map((topicId) => ({
        topicId,
        questions: this.allQuestions.filter((q) => q.topicId === topicId),
      }))
      .filter((t) => t.questions.length > 0);

    if (!topicsWithQuestions.length) {
      return [];
    }

    let questionsPerTopic = Math.floor(questionCount / topicsWithQuestions.length);
    let remainder = questionCount % topicsWithQuestions.length;

    for (const topic of topicsWithQuestions) {
      let count = questionsPerTopic + (remainder > 0 ? 1 : 0);
      remainder--;

      const shuffledQuestions = this.shuffleArray(topic.questions);
      questions.push(...shuffledQuestions.slice(0, count));
    }

    return questions.map((question) => ({
      ...question,
      options: question.options.map((option) => ({ ...option })),
      userSelectedOptionId: null,
    }));
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

  private normalizeMasterData(masterTopics: MasterTopic[]): { topics: Topic[]; topicGroups: TopicGroup[]; questions: Question[] } {
    if (!Array.isArray(masterTopics)) {
      return { topics: [], topicGroups: [], questions: [] };
    }

    const topics: Topic[] = [];
    const topicGroups: TopicGroup[] = [];
    const questions: Question[] = [];
    const seenTopicIds = new Set<string>();

    for (const parentTopic of masterTopics) {
      if (!parentTopic || typeof parentTopic.id !== 'string' || typeof parentTopic.name !== 'string') {
        continue;
      }

      const parentDescription = typeof parentTopic.description === 'string' ? parentTopic.description : '';
      const childTopics = this.readChildTopics(parentTopic);

      if (childTopics.length > 0) {
        const normalizedChildren: Topic[] = [];
        const topicIdsForGroup: string[] = [];

        for (const childTopic of childTopics) {
          const normalizedChild = this.normalizeLeafTopic(childTopic, parentDescription, seenTopicIds);
          if (!normalizedChild) {
            continue;
          }

          topics.push(normalizedChild.topic);
          questions.push(...normalizedChild.questions);
          normalizedChildren.push(normalizedChild.topic);
          topicIdsForGroup.push(normalizedChild.topic.id);
        }

        if (!topicIdsForGroup.length) {
          continue;
        }

        topicGroups.push({
          id: parentTopic.id,
          name: parentTopic.name,
          description: parentDescription,
          hasChildren: true,
          topicIds: topicIdsForGroup,
          children: normalizedChildren,
        });
        continue;
      }

      const normalizedStandaloneTopic = this.normalizeLeafTopic(parentTopic, parentDescription, seenTopicIds);
      if (!normalizedStandaloneTopic) {
        continue;
      }

      topics.push(normalizedStandaloneTopic.topic);
      questions.push(...normalizedStandaloneTopic.questions);
      topicGroups.push({
        id: parentTopic.id,
        name: parentTopic.name,
        description: parentDescription || normalizedStandaloneTopic.topic.description,
        hasChildren: false,
        topicIds: [normalizedStandaloneTopic.topic.id],
        children: [normalizedStandaloneTopic.topic],
      });
    }

    const sortedTopics = [...topics].sort((a, b) => QuizService.NAME_COLLATOR.compare(a.name, b.name));
    const sortedTopicGroups = topicGroups
      .map((group) => this.sortTopicGroupAlphabetically(group))
      .sort((a, b) => QuizService.NAME_COLLATOR.compare(a.name, b.name));

    return {
      topics: sortedTopics,
      topicGroups: sortedTopicGroups,
      questions,
    };
  }

  private sortTopicGroupAlphabetically(group: TopicGroup): TopicGroup {
    const sortedChildren = [...group.children].sort((a, b) => QuizService.NAME_COLLATOR.compare(a.name, b.name));
    const sortedTopicIds = sortedChildren.map((topic) => topic.id);

    return {
      ...group,
      children: sortedChildren,
      topicIds: sortedTopicIds,
    };
  }

  private readChildTopics(topic: MasterTopic): MasterTopicChild[] {
    const candidates = topic as MasterTopic & {
      topics?: unknown;
      tests?: unknown;
      subtopics?: unknown;
    };
    const childArrays = [topic.children, candidates.topics, candidates.tests, candidates.subtopics];
    for (const childArray of childArrays) {
      if (Array.isArray(childArray)) {
        return childArray as MasterTopicChild[];
      }
    }
    return [];
  }

  private normalizeLeafTopic(
    source: Pick<MasterTopicChild, 'id' | 'name'> & { description?: string; questions?: MasterQuestion[] },
    fallbackDescription: string,
    seenTopicIds: Set<string>,
  ): { topic: Topic; questions: Question[] } | null {
    if (!source || typeof source.id !== 'string' || typeof source.name !== 'string') {
      return null;
    }

    const topicId = source.id.trim();
    if (!topicId || seenTopicIds.has(topicId)) {
      return null;
    }

    const normalizedQuestions = this.normalizeQuestionsForTopic(topicId, source.questions);
    if (!normalizedQuestions.length) {
      return null;
    }

    seenTopicIds.add(topicId);
    return {
      topic: {
        id: topicId,
        name: source.name,
        description: typeof source.description === 'string' ? source.description : fallbackDescription,
      },
      questions: normalizedQuestions,
    };
  }

  private normalizeQuestionsForTopic(topicId: string, sourceQuestions: MasterQuestion[] | undefined): Question[] {
    if (!Array.isArray(sourceQuestions)) {
      return [];
    }

    const questions: Question[] = [];
    for (const question of sourceQuestions) {
      const questionText = typeof question?.text === 'string' ? question.text : question?.questionText;
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
        topicId,
        text: questionText,
        options,
        correctOptionId: question.correctOptionId,
        userSelectedOptionId: null,
      });
    }

    return questions;
  }

  private buildMasterDataCacheKey(userId: string): string {
    return `${QuizService.MASTER_DATA_CACHE_KEY_PREFIX}.${userId}.v1`;
  }
}
