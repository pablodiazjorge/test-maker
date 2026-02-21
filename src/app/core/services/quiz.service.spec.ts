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
    // With default fixture (2 topics, 2 questions each), we ask for 3 questions.
    // The new logic will give 2 from one topic, 1 from another. Total is 3.
    service.setMasterData(createMasterTopicsFixture(), 'alice');
    service.startQuiz({
      questionCount: 3,
      shuffleQuestions: false,
      shuffleAnswers: false,
      selectedTopicIds: ['topic-1', 'topic-2'],
    });

    const [q1, q2] = service.questions();
    const incorrectOptionForQ2 = q2.options.find((o) => o.id !== q2.correctOptionId);
    expect(incorrectOptionForQ2).toBeDefined();

    // Answer one correctly, one incorrectly
    service.selectAnswer(q1.id, q1.correctOptionId);
    service.selectAnswer(q2.id, incorrectOptionForQ2!.id);

    const results = service.results();
    expect(results.total).toBe(3);
    expect(results.answered).toBe(2);
    expect(results.correct).toBe(1);
    expect(results.incorrect).toBe(1);
    expect(results.unanswered).toBe(1);
    expect(results.scorePercent).toBe(33); // 1 correct out of 3 total

    // Verify topic breakdown adds up
    const totalByTopic = results.byTopic.reduce((sum, t) => sum + t.total, 0);
    const correctByTopic = results.byTopic.reduce((sum, t) => sum + t.correct, 0);
    const incorrectByTopic = results.byTopic.reduce((sum, t) => sum + t.incorrect, 0);
    const unansweredByTopic = results.byTopic.reduce((sum, t) => sum + t.unanswered, 0);

    expect(totalByTopic).toBe(results.total);
    expect(correctByTopic).toBe(results.correct);
    expect(incorrectByTopic).toBe(results.incorrect);
    expect(unansweredByTopic).toBe(results.unanswered);
    expect(results.byTopic).toHaveLength(2);
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

  it('selects a random, evenly distributed subset of questions from multiple topics', () => {
    const masterData = createMasterTopicsFixture({ topicCount: 3, questionsPerTopic: 10 });
    service.setMasterData(masterData, 'alice');

    service.startQuiz({
      questionCount: 5,
      shuffleQuestions: true,
      shuffleAnswers: true,
      selectedTopicIds: ['topic-1', 'topic-2', 'topic-3'],
    });

    const questions = service.questions();
    expect(questions).toHaveLength(5);

    const counts: Record<string, number> = {
      'topic-1': 0,
      'topic-2': 0,
      'topic-3': 0,
    };

    for (const q of questions) {
      counts[q.topicId]++;
    }

    // 5 questions from 3 topics = 2, 2, 1
    const distribution = Object.values(counts).sort((a, b) => b - a);
    expect(distribution).toEqual([2, 2, 1]);
  });
});
