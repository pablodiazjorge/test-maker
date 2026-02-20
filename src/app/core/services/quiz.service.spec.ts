import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { QuizService } from './quiz.service';
import { createMasterTopicsFixture } from '../../../testing/quiz-fixtures';

describe('QuizService', () => {
  let service: QuizService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(QuizService);
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('loads and normalizes master data', () => {
    const loaded = service.setMasterData(createMasterTopicsFixture(), 'alice');

    expect(loaded).toBe(true);
    expect(service.isDataLoaded()).toBe(true);
    expect(service.topics).toHaveLength(2);
    expect(service.getQuestionCountForTopic('topic-1')).toBe(2);
    expect(service.getQuestionCountForTopic('topic-2')).toBe(2);
  });

  it('fails when master data is empty', () => {
    const loaded = service.setMasterData([], 'alice');

    expect(loaded).toBe(false);
    expect(service.isDataLoaded()).toBe(false);
    expect(service.dataLoadError()).toBe('Master data is empty or invalid.');
  });

  it('starts a quiz and clamps questionCount to pool size', () => {
    service.setMasterData(createMasterTopicsFixture(), 'alice');

    service.startQuiz({
      questionCount: 99,
      shuffleQuestions: false,
      shuffleAnswers: false,
      selectedTopicIds: ['topic-1'],
    });

    expect(service.questions()).toHaveLength(2);
    expect(service.currentIndex()).toBe(0);
    expect(service.config().questionCount).toBe(2);
  });

  it('sets empty quiz when selected topics have no available questions', () => {
    service.setMasterData(createMasterTopicsFixture(), 'alice');

    service.startQuiz({
      questionCount: 3,
      shuffleQuestions: true,
      shuffleAnswers: true,
      selectedTopicIds: ['missing-topic'],
    });

    expect(service.questions()).toHaveLength(0);
    expect(service.config().questionCount).toBe(0);
  });

  it('updates answers only when option exists', () => {
    service.setMasterData(createMasterTopicsFixture(), 'alice');
    service.startQuiz({
      questionCount: 2,
      shuffleQuestions: false,
      shuffleAnswers: false,
      selectedTopicIds: ['topic-1'],
    });

    const [firstQuestion] = service.questions();
    service.selectAnswer(firstQuestion.id, 'invalid-option');
    expect(service.questions()[0].userSelectedOptionId).toBeNull();

    service.selectAnswer(firstQuestion.id, firstQuestion.correctOptionId);
    expect(service.questions()[0].userSelectedOptionId).toBe(firstQuestion.correctOptionId);
  });

  it('navigates between questions with bounds', () => {
    service.setMasterData(createMasterTopicsFixture(), 'alice');
    service.startQuiz({
      questionCount: 2,
      shuffleQuestions: false,
      shuffleAnswers: false,
      selectedTopicIds: ['topic-1'],
    });

    service.goToQuestion(10);
    expect(service.currentIndex()).toBe(1);

    service.previousQuestion();
    expect(service.currentIndex()).toBe(0);

    service.previousQuestion();
    expect(service.currentIndex()).toBe(0);
  });

  it('computes results with topic breakdown', () => {
    service.setMasterData(createMasterTopicsFixture(), 'alice');
    service.startQuiz({
      questionCount: 3,
      shuffleQuestions: false,
      shuffleAnswers: false,
      selectedTopicIds: ['topic-1', 'topic-2'],
    });

    const [q1, q2] = service.questions();
    service.selectAnswer(q1.id, q1.correctOptionId);
    service.selectAnswer(q2.id, 'q-2-b');

    const results = service.results();
    expect(results.total).toBe(3);
    expect(results.answered).toBe(2);
    expect(results.correct).toBe(1);
    expect(results.incorrect).toBe(1);
    expect(results.unanswered).toBe(1);
    expect(results.scorePercent).toBe(33);
    expect(results.byTopic).toEqual([
      {
        topicId: 'topic-1',
        topicName: 'HTML',
        total: 2,
        correct: 1,
        incorrect: 1,
        unanswered: 0,
      },
      {
        topicId: 'topic-2',
        topicName: 'CSS',
        total: 1,
        correct: 0,
        incorrect: 0,
        unanswered: 1,
      },
    ]);
  });

  it('restores cached master data for an existing user', () => {
    const firstLoad = service.setMasterData(createMasterTopicsFixture(), 'alice');
    expect(firstLoad).toBe(true);

    service.clearMasterData({ clearCache: false });
    expect(service.isDataLoaded()).toBe(false);

    const restored = service.restoreMasterDataFromCache('alice');
    expect(restored).toBe(true);
    expect(service.isDataLoaded()).toBe(true);
    expect(service.topics).toHaveLength(2);
  });
});
