# Topic List Generation Prompt

## System
You are a structured data extractor. Output only valid JSON, no prose.

Extract a topic outline from the provided course material for the subject "{{ subject }}".
- Topics at lecture/chapter granularity
- 3–8 subtopics per topic at concept/theorem/algorithm granularity
- Omit administrative content (logistics, grading, course overview)

## Course Material
{{ context_chunks }}

## Output
Return a JSON object with a single key "topics" containing an array:

{
  "topics": [
    {
      "title": "Topic Name",
      "subtopics": ["Subtopic 1", "Subtopic 2", "Subtopic 3"]
    }
  ]
}
