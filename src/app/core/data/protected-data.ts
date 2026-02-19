import { MasterTopic } from './quiz.data';

export interface ProtectedDataResponse {
  userId: string;
  data: MasterTopic[];
}
