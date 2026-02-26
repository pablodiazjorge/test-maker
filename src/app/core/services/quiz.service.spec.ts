import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { QuizService } from './quiz.service';
import { createMasterTopicGroupsFixture, createMasterTopicsFixture } from './quiz.service.fixtures';

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
    expect(service.topicGroups).toHaveLength(2);
    expect(service.topicGroups.every((group) => group.hasChildren === false)).toBe(true);
    expect(service.getQuestionCountForTopic('topic-1')).toBe(2);
    expect(service.getQuestionCountForTopic('topic-2')).toBe(2);
  });

  it('loads grouped topics with child and standalone modes', () => {
    const loaded = service.setMasterData(createMasterTopicGroupsFixture(), 'alice');

    expect(loaded).toBe(true);
    expect(service.isDataLoaded()).toBe(true);
    expect(service.topics).toHaveLength(3);
    expect(service.topicGroups).toHaveLength(2);
    expect(service.topicGroups[0]).toMatchObject({
      id: 'tema-3-union-europea',
      hasChildren: true,
      topicIds: ['topic-1', 'topic-2'],
    });
    expect(service.topicGroups[1]).toMatchObject({
      id: 'tema-prueba-sin-hijos',
      hasChildren: false,
      topicIds: ['tema-prueba-sin-hijos'],
    });
    expect(service.getQuestionCountForTopic('topic-1')).toBe(2);
    expect(service.getQuestionCountForTopic('topic-2')).toBe(2);
    expect(service.getQuestionCountForTopic('tema-prueba-sin-hijos')).toBe(2);
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
    const incorrectOptionForQ2 = q2.options.find((o) => o.id !== q2.correctOptionId);
    expect(incorrectOptionForQ2).toBeDefined();

    service.selectAnswer(q1.id, q1.correctOptionId);
    service.selectAnswer(q2.id, incorrectOptionForQ2!.id);

    const results = service.results();
    expect(results.total).toBe(3);
    expect(results.answered).toBe(2);
    expect(results.correct).toBe(1);
    expect(results.incorrect).toBe(1);
    expect(results.unanswered).toBe(1);
    expect(results.score).toBe(3.33); // 1 correct out of 3 total, no penalty yet

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

  it('applies a penalty of one question value for every three incorrect answers', () => {
    service.setMasterData(createMasterTopicsFixture({ topicCount: 1, questionsPerTopic: 6 }), 'alice');
    service.startQuiz({
      questionCount: 6,
      shuffleQuestions: false,
      shuffleAnswers: false,
      selectedTopicIds: ['topic-1'],
    });

    const questions = service.questions();
    expect(questions).toHaveLength(6);

    for (const question of questions.slice(0, 3)) {
      service.selectAnswer(question.id, question.correctOptionId);
    }

    for (const question of questions.slice(3, 6)) {
      const incorrectOption = question.options.find((option) => option.id !== question.correctOptionId);
      expect(incorrectOption).toBeDefined();
      service.selectAnswer(question.id, incorrectOption!.id);
    }

    const results = service.results();
    expect(results.correct).toBe(3);
    expect(results.incorrect).toBe(3);
    expect(results.score).toBe(3.33); // (3 - floor(3/3)) * (10/6) = 3.33
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

    const distribution = Object.values(counts).sort((a, b) => b - a);
    expect(distribution).toEqual([2, 2, 1]);
  });
});
