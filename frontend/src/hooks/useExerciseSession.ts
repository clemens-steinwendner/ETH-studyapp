"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { Exercise, Submission } from "@/types/exercise";

type State = "idle" | "loading" | "active" | "graded";

export function useExerciseSession(sessionId: number) {
  const [state, setState] = useState<State>("idle");
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Prefetch state
  const [prefetched, setPrefetched] = useState<Exercise | null>(null);
  const [prefetching, setPrefetching] = useState(false);

  async function prefetchNext(questionType: string, language?: string) {
    if (prefetching) return;
    setPrefetching(true);
    try {
      const ex = await api<Exercise>("/api/v1/exercises/generate", {
        method: "POST",
        body: JSON.stringify({ session_id: sessionId, question_type: questionType, language }),
      });
      setPrefetched(ex);
    } catch {
      // Silently discard — nextExercise will retry on-demand
    } finally {
      setPrefetching(false);
    }
  }

  async function nextExercise(questionType: string, language?: string) {
    // Consume prefetched if available
    if (prefetched) {
      setExercise(prefetched);
      setPrefetched(null);
      setSubmission(null);
      setState("active");
      return;
    }

    setState("loading");
    setError(null);
    try {
      const ex = await api<Exercise>("/api/v1/exercises/generate", {
        method: "POST",
        body: JSON.stringify({ session_id: sessionId, question_type: questionType, language }),
      });
      setExercise(ex);
      setSubmission(null);
      setState("active");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate question.");
      setState("idle");
    }
  }

  async function submitAnswer(answerText?: string, answerImagePath?: string): Promise<Submission | undefined> {
    if (!exercise) return;
    const sub = await api<Submission>(`/api/v1/exercises/${exercise.id}/submit`, {
      method: "POST",
      body: JSON.stringify({ answer_text: answerText, answer_image_path: answerImagePath }),
    });
    setSubmission(sub);
    setState("graded");
    return sub;
  }

  return { state, exercise, submission, error, nextExercise, submitAnswer, prefetchNext, prefetching };
}
