export interface Option {
  id: string;
  text: string;
}

export interface MasterQuestion {
  id: string;
  text?: string;
  questionText?: string;
  options: Option[];
  correctOptionId: string;
}

export interface MasterTopic {
  id: string;
  name: string;
  description: string;
  questions: MasterQuestion[];
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

export const DEFAULT_QUIZ_CONFIG: QuizConfig = {
  questionCount: 10,
  shuffleQuestions: true,
  shuffleAnswers: false,
  selectedTopicIds: ['topic-1'],
};
