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

export interface MasterTopicChild {
  id: string;
  name: string;
  description?: string;
  questions: MasterQuestion[];
}

export interface MasterTopic {
  id: string;
  name: string;
  description?: string;
  questions?: MasterQuestion[];
  children?: MasterTopicChild[];
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

export interface TopicGroup {
  id: string;
  name: string;
  description: string;
  hasChildren: boolean;
  topicIds: string[];
  children: Topic[];
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
  selectedTopicIds: [],
};
