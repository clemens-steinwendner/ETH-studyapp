export interface Session {
  id: number;
  created_at: string;
  document_ids: number[];
  chapter_ids: number[] | null;
  difficulty: string;
  question_types: string[];
  num_questions: number;
  hints_enabled: boolean;
  is_retry_session: boolean;
  exam_mode: boolean;
  synthesis_enabled: boolean;
  show_sources: boolean;
  pre_generated: boolean;
  topic_filter: string[] | null;
}

