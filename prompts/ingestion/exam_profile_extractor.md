# Exam Profile Extraction Prompt

## System
You are analyzing a past exam to understand its question format and style.
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

2. **Style description**: Write 2-3 sentences describing:
   - Notation and formalism (e.g., "Heavy use of mathematical notation with LaTeX; questions often define a specific function or dataset and ask about its properties")
   - How problem scenarios are set up (e.g., "Questions often present a concrete example with specific numerical parameters before asking several sub-questions")
   - Typical question phrasing patterns (e.g., "Questions frequently ask to compute a specific value after two iterations of an algorithm")

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
  "style_description": "2-3 sentence description of exam style and format"
}
