/**
 * Exam-mode time budgets per question type (seconds). Tuned to match typical
 * ETH CS mock-exam per-question allocations.
 */
export const TIME_BUDGET_S: Record<string, number> = {
  coding: 480,         // 8 min
  open_ended: 240,     // 4 min
  multiple_select: 150,
  multiple_choice: 90,
  true_false: 60,
};

export function estimateExamSeconds(questionTypes: string[], n: number): number {
  if (!questionTypes.length || n <= 0) return 0;
  // Average the budgets across enabled types; assume uniform mix.
  const avg =
    questionTypes.reduce((sum, t) => sum + (TIME_BUDGET_S[t] ?? 180), 0) / questionTypes.length;
  return Math.round(avg * n);
}

export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (x: number) => x.toString().padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}
