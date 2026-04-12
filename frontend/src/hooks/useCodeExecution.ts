"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { ExecutionResult } from "@/types/exercise";

export function useCodeExecution() {
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function execute(exerciseId: number, language: string, userCode: string, testCases: string) {
    setLoading(true);
    try {
      const data = await api<ExecutionResult>("/api/v1/execute/", {
        method: "POST",
        body: JSON.stringify({ exercise_id: exerciseId, language, user_code: userCode, test_cases: testCases }),
      });
      setResult(data);
    } finally {
      setLoading(false);
    }
  }

  return { result, loading, execute };
}
