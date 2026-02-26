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

export function createMasterTopicGroupsFixture(): MasterTopic[] {
  const childOneQuestions = [
    {
      id: 'q-1-1',
      text: 'Question 1 for Child Topic 1',
      options: [
        { id: 'q-1-1-a', text: 'Option A' },
        { id: 'q-1-1-b', text: 'Option B' },
      ],
      correctOptionId: 'q-1-1-a',
    },
    {
      id: 'q-1-2',
      text: 'Question 2 for Child Topic 1',
      options: [
        { id: 'q-1-2-a', text: 'Option A' },
        { id: 'q-1-2-b', text: 'Option B' },
      ],
      correctOptionId: 'q-1-2-a',
    },
  ];

  const childTwoQuestions = [
    {
      id: 'q-2-1',
      text: 'Question 1 for Child Topic 2',
      options: [
        { id: 'q-2-1-a', text: 'Option A' },
        { id: 'q-2-1-b', text: 'Option B' },
      ],
      correctOptionId: 'q-2-1-a',
    },
    {
      id: 'q-2-2',
      text: 'Question 2 for Child Topic 2',
      options: [
        { id: 'q-2-2-a', text: 'Option A' },
        { id: 'q-2-2-b', text: 'Option B' },
      ],
      correctOptionId: 'q-2-2-a',
    },
  ];

  const standaloneQuestions = [
    {
      id: 'q-standalone-1',
      text: 'Question 1 for Standalone Topic',
      options: [
        { id: 'q-standalone-1-a', text: 'Option A' },
        { id: 'q-standalone-1-b', text: 'Option B' },
      ],
      correctOptionId: 'q-standalone-1-a',
    },
    {
      id: 'q-standalone-2',
      text: 'Question 2 for Standalone Topic',
      options: [
        { id: 'q-standalone-2-a', text: 'Option A' },
        { id: 'q-standalone-2-b', text: 'Option B' },
      ],
      correctOptionId: 'q-standalone-2-a',
    },
  ];

  return [
    {
      id: 'tema-3-union-europea',
      name: 'TEMA 3: Union Europea',
      description: 'Bloque principal con tests hijos',
      children: [
        {
          id: 'topic-1',
          name: 'Test 1',
          description: 'Subtema 1',
          questions: childOneQuestions,
        },
        {
          id: 'topic-2',
          name: 'Test 2',
          description: 'Subtema 2',
          questions: childTwoQuestions,
        },
      ],
    },
    {
      id: 'tema-prueba-sin-hijos',
      name: 'Tema Prueba: Sin hijos',
      description: 'Tema standalone sin subtemas',
      questions: standaloneQuestions,
    },
  ];
}
