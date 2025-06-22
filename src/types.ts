export interface Question {
  question: string;
  answers: string[];
  correct: string;
}

export type Language = 'ro' | 'en';

export interface Session {
  id: string;
  timestamp: number;
  totalQuestions: number;
  currentQuestionIndex: number;
  score: number;
  isTest: boolean;
  questionIds: number[]; 
  answeredQuestions: number[];
  completed: boolean;
}
