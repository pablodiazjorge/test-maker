import { MasterTopic } from '../app/core/data/quiz.data';

export function createMasterTopicsFixture(): MasterTopic[] {
  return [
    {
      id: 'topic-1',
      name: 'HTML',
      description: 'Semantic HTML',
      questions: [
        {
          id: 'q-1',
          text: 'What tag defines a paragraph?',
          options: [
            { id: 'q-1-a', text: '<p>' },
            { id: 'q-1-b', text: '<div>' },
          ],
          correctOptionId: 'q-1-a',
        },
        {
          id: 'q-2',
          text: 'What tag is used for links?',
          options: [
            { id: 'q-2-a', text: '<a>' },
            { id: 'q-2-b', text: '<span>' },
          ],
          correctOptionId: 'q-2-a',
        },
      ],
    },
    {
      id: 'topic-2',
      name: 'CSS',
      description: 'Selectors and layout',
      questions: [
        {
          id: 'q-3',
          text: 'Which property sets text color?',
          options: [
            { id: 'q-3-a', text: 'color' },
            { id: 'q-3-b', text: 'font-size' },
          ],
          correctOptionId: 'q-3-a',
        },
        {
          id: 'q-4',
          text: 'Which display value uses flexbox?',
          options: [
            { id: 'q-4-a', text: 'flex' },
            { id: 'q-4-b', text: 'block' },
          ],
          correctOptionId: 'q-4-a',
        },
      ],
    },
  ];
}
