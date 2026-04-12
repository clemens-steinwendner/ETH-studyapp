"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { Exercise, Submission } from "@/types/exercise";

type State = "idle" | "loading" | "active" | "graded";

export function useExerciseSession(sessionId: number) {
  const [state, setState] = useState<State>("idle");
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);

  async function nextExercise(questionType: string, language?: string) {
    setState("loading");
    try {
      const ex = await api<Exercise>("/api/v1/exercises/generate", {
        method: "POST",
        body: JSON.stringify({ session_id: sessionId, question_type: questionType, language }),
      });
      setExercise(ex);
      setSubmission(null);
      setState("active");
    } catch {
      setState("idle");
    }
  }

  async function submitAnswer(answerText?: string, answerImagePath?: string) {
    if (!exercise) return;
    const sub = await api<Submission>(`/api/v1/exercises/${exercise.id}/submit`, {
      method: "POST",
      body: JSON.stringify({ answer_text: answerText, answer_image_path: answerImagePath }),
    });
    setSubmission(sub);
    setState("graded");
  }

  return { state, exercise, submission, nextExercise, submitAnswer };
}
