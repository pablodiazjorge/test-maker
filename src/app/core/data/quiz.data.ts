export interface Option {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  topicId: string;
  text: string;
  options: Option[];
  correctOptionId: string;
  userSelectedOptionId?: string | null;
}

export interface Topic {
  id: string;
  name: string;
  description: string;
}

export interface QuizConfig {
  questionCount: number;
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  selectedTopicIds: string[];
}

export const TOPICS: Topic[] = [
  {
    id: 'topic-1',
    name: 'Tema 1',
    description: 'Biologia y Quimica basica',
  },
  {
    id: 'topic-2',
    name: 'Tema 2',
    description: 'Historia y Cultura general',
  },
  {
    id: 'topic-3',
    name: 'Tema 3',
    description: 'Astronomia y Ciencias de la Tierra',
  },
];

export const DEFAULT_QUIZ_CONFIG: QuizConfig = {
  questionCount: 10,
  shuffleQuestions: true,
  shuffleAnswers: false,
  selectedTopicIds: ['topic-1'],
};

export const QUESTIONS: Question[] = [
  {
    id: 'q-1',
    topicId: 'topic-1',
    text: 'What is the powerhouse of the cell?',
    correctOptionId: 'q-1-o-3',
    options: [
      { id: 'q-1-o-1', text: 'Ribosome' },
      { id: 'q-1-o-2', text: 'Nucleus' },
      { id: 'q-1-o-3', text: 'Mitochondria' },
      { id: 'q-1-o-4', text: 'Cytoplasm' },
    ],
  },
  {
    id: 'q-2',
    topicId: 'topic-1',
    text: 'What is the chemical symbol for Gold?',
    correctOptionId: 'q-2-o-3',
    options: [
      { id: 'q-2-o-1', text: 'Gd' },
      { id: 'q-2-o-2', text: 'Ag' },
      { id: 'q-2-o-3', text: 'Au' },
      { id: 'q-2-o-4', text: 'Go' },
    ],
  },
  {
    id: 'q-3',
    topicId: 'topic-1',
    text: 'Which blood cells are responsible for oxygen transport?',
    correctOptionId: 'q-3-o-2',
    options: [
      { id: 'q-3-o-1', text: 'White blood cells' },
      { id: 'q-3-o-2', text: 'Red blood cells' },
      { id: 'q-3-o-3', text: 'Platelets' },
      { id: 'q-3-o-4', text: 'Plasma' },
    ],
  },
  {
    id: 'q-4',
    topicId: 'topic-2',
    text: 'In which year did the Titanic sink?',
    correctOptionId: 'q-4-o-2',
    options: [
      { id: 'q-4-o-1', text: '1910' },
      { id: 'q-4-o-2', text: '1912' },
      { id: 'q-4-o-3', text: '1914' },
      { id: 'q-4-o-4', text: '1918' },
    ],
  },
  {
    id: 'q-5',
    topicId: 'topic-2',
    text: 'Which civilization built Machu Picchu?',
    correctOptionId: 'q-5-o-1',
    options: [
      { id: 'q-5-o-1', text: 'Inca' },
      { id: 'q-5-o-2', text: 'Maya' },
      { id: 'q-5-o-3', text: 'Aztec' },
      { id: 'q-5-o-4', text: 'Olmec' },
    ],
  },
  {
    id: 'q-6',
    topicId: 'topic-2',
    text: 'Who wrote "Don Quixote"?',
    correctOptionId: 'q-6-o-4',
    options: [
      { id: 'q-6-o-1', text: 'Lope de Vega' },
      { id: 'q-6-o-2', text: 'Federico Garcia Lorca' },
      { id: 'q-6-o-3', text: 'Pablo Neruda' },
      { id: 'q-6-o-4', text: 'Miguel de Cervantes' },
    ],
  },
  {
    id: 'q-7',
    topicId: 'topic-3',
    text: 'Which planet is known as the Red Planet?',
    correctOptionId: 'q-7-o-1',
    options: [
      { id: 'q-7-o-1', text: 'Mars' },
      { id: 'q-7-o-2', text: 'Venus' },
      { id: 'q-7-o-3', text: 'Jupiter' },
      { id: 'q-7-o-4', text: 'Saturn' },
    ],
  },
  {
    id: 'q-8',
    topicId: 'topic-3',
    text: 'What is the closest star to Earth?',
    correctOptionId: 'q-8-o-2',
    options: [
      { id: 'q-8-o-1', text: 'Alpha Centauri' },
      { id: 'q-8-o-2', text: 'The Sun' },
      { id: 'q-8-o-3', text: 'Sirius' },
      { id: 'q-8-o-4', text: 'Proxima Centauri' },
    ],
  },
  {
    id: 'q-9',
    topicId: 'topic-3',
    text: 'What causes ocean tides on Earth?',
    correctOptionId: 'q-9-o-4',
    options: [
      { id: 'q-9-o-1', text: 'Earthquakes' },
      { id: 'q-9-o-2', text: 'Ocean currents' },
      { id: 'q-9-o-3', text: 'Solar wind' },
      { id: 'q-9-o-4', text: 'Gravitational pull of Moon and Sun' },
    ],
  },
  {
    id: 'q-10',
    topicId: 'topic-1',
    text: 'How many chromosomes does a typical human cell have?',
    correctOptionId: 'q-10-o-2',
    options: [
      { id: 'q-10-o-1', text: '23' },
      { id: 'q-10-o-2', text: '46' },
      { id: 'q-10-o-3', text: '44' },
      { id: 'q-10-o-4', text: '92' },
    ],
  },
  {
    id: 'q-11',
    topicId: 'topic-2',
    text: 'The Renaissance began in which country?',
    correctOptionId: 'q-11-o-1',
    options: [
      { id: 'q-11-o-1', text: 'Italy' },
      { id: 'q-11-o-2', text: 'France' },
      { id: 'q-11-o-3', text: 'Germany' },
      { id: 'q-11-o-4', text: 'Spain' },
    ],
  },
  {
    id: 'q-12',
    topicId: 'topic-3',
    text: 'What layer of Earth is liquid and mostly iron?',
    correctOptionId: 'q-12-o-3',
    options: [
      { id: 'q-12-o-1', text: 'Crust' },
      { id: 'q-12-o-2', text: 'Mantle' },
      { id: 'q-12-o-3', text: 'Outer core' },
      { id: 'q-12-o-4', text: 'Inner core' },
    ],
  },
];
