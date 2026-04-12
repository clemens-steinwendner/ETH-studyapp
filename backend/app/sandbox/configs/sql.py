"""
SQL sandbox execution configuration (FR-19).

Injects a pre-defined relational schema before running the user's query
and the assertion tests. Uses DuckDB for fast in-process SQL execution.
"""
from pathlib import Path

SCHEMA_DIR = Path(__file__).parent.parent.parent.parent.parent / "sql_schemas"

SETUP_COMMANDS = [
    "pip install duckdb --quiet",
]

RUNNER_COMMAND = "python run_sql_tests.py"


def get_schema_sql(subject: str = "databases_course") -> str:
    schema_file = SCHEMA_DIR / f"{subject}.sql"
    if not schema_file.exists():
        return ""
    return schema_file.read_text()
