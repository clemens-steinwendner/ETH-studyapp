# Exam Profile Extraction Prompt

## System
You are analyzing a past exam to understand its question format, topical emphasis, and the kinds of mistakes students typically make.
Extract a structured profile from the provided exam content.
Write only the JSON result — no reasoning, no analysis, no planning.

## Instructions
Analyze the exam content below and determine:

1. **Question type distribution**: What fraction of questions fall into each of these categories?
   - `true_false`: Single statement to mark True or False
   - `multiple_choice`: Single-answer multiple choice (exactly one correct option)
   - `multiple_select`: Multi-answer multiple choice ("mark all that apply", multiple correct)
   - `open_ended`: Written explanation, proof, derivation, or short answer
   - `numerical`: Compute or calculate a specific numerical result (even if presented as MC)
   - `coding`: Write or trace code

   Proportions must sum to 1.0. Omit types that don't appear.

2. **Style description**: 2–3 sentences on notation/formalism, problem framing, and typical phrasing patterns.

3. **Topic frequency**: A dict mapping each visibly-tested topic (use short, lowercase, kebab-case keys, e.g. `"window-functions"`, `"hoare-logic"`, `"markov-chains"`) to a relative weight in `[0, 1]`. Weights should roughly sum to 1.0. Omit if the exam content is too thin to identify topics.

4. **Difficulty mix**: A dict with keys `recall`, `application`, `synthesis` summing to 1.0, estimating how much of the exam tests each cognitive level.

5. **Common traps**: 3–5 short bullet strings naming concrete mistakes the exam appears designed to catch (e.g. `"off-by-one in window frames"`, `"confusing CFG with PDA"`, `"forgetting base case in induction"`). Each entry ≤ 80 characters.

## Context
{{ context_chunks }}

## Output Format
Respond with ONLY valid JSON — no prose before or after.

{
  "question_type_distribution": {
    "true_false": 0.35,
    "multiple_choice": 0.40,
    "multiple_select": 0.15,
    "open_ended": 0.10
  },
  "style_description": "2-3 sentence description of exam style and format",
  "topic_frequency": {
    "topic-a": 0.4,
    "topic-b": 0.35,
    "topic-c": 0.25
  },
  "difficulty_mix": {
    "recall": 0.2,
    "application": 0.5,
    "synthesis": 0.3
  },
  "common_traps": [
    "off-by-one in window frames",
    "confusing left vs right outer join",
    "forgetting NULL semantics in aggregates"
  ]
}
