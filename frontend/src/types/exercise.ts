export interface Exercise {
  id: number;
  session_id: number;
  created_at: string;
  question_type: string;
  language: string | null;
  question_text: string;
  options: string[] | null; // populated for multiple_choice exercises
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
