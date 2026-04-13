# Topic List Generation Prompt

## System
You are an expert course analyst. Your job is to extract a structured topic outline
from provided course material for the subject "{{ subject }}".

## Instructions
- Identify the major topics covered in the material
- For each topic, list 3–8 specific subtopics or concepts
- Topics should be at lecture/chapter granularity
- Subtopics should be at concept/theorem/algorithm granularity
- Be concise but specific — a student should be able to use this list to select
  exactly what they want to practise
- Do NOT include administrative topics (grading, overview, logistics)

## Course Material
{{ context_chunks }}

## Output Format
Your entire response must be ONLY the following JSON array wrapped in a ```json code fence. No prose before or after.

```json
[
  {
    "title": "Topic Name",
    "subtopics": ["Subtopic 1", "Subtopic 2", "Subtopic 3"]
  }
]
```
