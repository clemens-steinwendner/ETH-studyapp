export interface SourceRef {
  document_id: number;
  document_name?: string | null;
  chapter_id?: number | null;
  chapter_title?: string | null;
  page: number;
}

export interface Exercise {
  id: number;
  session_id: number;
  created_at: string;
  question_type: string;
  language: string | null;
  question_text: string;
  options: string[] | null;        // populated for multiple_choice / true_false / multiple_select
  correct_index: number | null;    // populated for multiple_choice / true_false
  correct_indices: number[] | null; // populated for multiple_select
  explanation: string | null;      // model answer / rationale (all types except coding)
  hint?: string | null;
  sources?: SourceRef[] | null;    // citations to source PDF pages
}

export interface Submission {
  id: number;
  exercise_id: number;
  passed: boolean;
  disputed: boolean;
  feedback: string | null;
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exit_code: number;
  passed: boolean;
  duration_ms: number;
}
