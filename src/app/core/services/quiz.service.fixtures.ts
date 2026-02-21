import { MasterTopic } from '../data/quiz.data';

export function createMasterTopicsFixture(options?: { topicCount?: number; questionsPerTopic?: number }): MasterTopic[] {
  const topicCount = options?.topicCount ?? 2;
  const questionsPerTopic = options?.questionsPerTopic ?? 2;
  const topics: MasterTopic[] = [];

  const topicNames = ['HTML', 'CSS', 'JavaScript', 'TypeScript', 'Angular', 'React'];

  for (let i = 1; i <= topicCount; i++) {
    const topicId = `topic-${i}`;
    const questions = [];

    for (let j = 1; j <= questionsPerTopic; j++) {
      const questionId = `q-${i}-${j}`;
      questions.push({
        id: questionId,
        text: `Question ${j} for Topic ${i}`,
        options: [
          { id: `${questionId}-a`, text: 'Option A' },
          { id: `${questionId}-b`, text: 'Option B' },
        ],
        correctOptionId: `${questionId}-a`,
      });
    }

    topics.push({
      id: topicId,
      name: topicNames[i - 1] ?? `Topic ${i}`,
      description: `Description for Topic ${i}`,
      questions,
    });
  }

  return topics;
}
