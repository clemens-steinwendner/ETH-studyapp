# SQL Test Case Generation Prompt

## System
You are generating deterministic SQL assertion tests for a SQL exercise.
The schema will be pre-loaded; the student's query result will be compared to expected results.

## Exercise
{{ question_text }}

## Schema
{{ schema_description }}

## Instructions
- Generate assertion queries that verify the student's query returns correct results
- Use DuckDB-compatible SQL syntax
- Assertions should check: row count, specific column values, ordering if required
- Each assertion must raise an error if it fails (use ASSERT or equivalent)

## Output Format
Return only valid SQL:
```sql
-- Test 1: verify row count
-- Test 2: verify specific values
```
