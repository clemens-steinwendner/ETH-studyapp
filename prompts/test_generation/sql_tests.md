# SQL Test Case Generation Prompt

## System
You are a JSON-only output machine. Output only valid JSON, no prose.

Generate deterministic SQL assertion tests for the SQL exercise below.
The schema will be pre-loaded; the student's query result will be compared to expected results.

## Exercise
{{ question_text }}

## Schema
{{ schema_description }}

## Instructions
- Assertion queries that verify the student's query returns correct results
- DuckDB-compatible SQL syntax
- Assertions check: row count, specific column values, ordering if required
- Each assertion raises an error if it fails

## Output
Return a JSON object with key "test_code" containing the complete SQL test code as a string.
