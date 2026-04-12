"""
Language execution registry (NFR-07).

Adding a new language requires only adding an entry to LANGUAGE_REGISTRY —
no changes to core routing logic in sandbox_service.py.
"""
from dataclasses import dataclass


@dataclass
class SandboxConfig:
    language_id: str
    sandbox_template: str      # E2B sandbox template identifier
    runner_template: str       # Jinja2 template filename in sandbox/templates/
    file_extension: str        # Extension for the user code file
    test_file_extension: str   # Extension for the test harness file


LANGUAGE_REGISTRY: dict[str, SandboxConfig] = {
    "python": SandboxConfig(
        language_id="python",
        sandbox_template="base",
        runner_template="python_runner.py.j2",
        file_extension=".py",
        test_file_extension="_test.py",
    ),
    "sql": SandboxConfig(
        language_id="sql",
        sandbox_template="base",
        runner_template="sql_runner.sql.j2",
        file_extension=".sql",
        test_file_extension="_test.sql",
    ),
    "haskell": SandboxConfig(
        language_id="haskell",
        sandbox_template="base",
        runner_template="haskell_runner.hs.j2",
        file_extension=".hs",
        test_file_extension="Test.hs",
    ),
}


def get_config(language_id: str) -> SandboxConfig:
    if language_id not in LANGUAGE_REGISTRY:
        raise ValueError(f"Unsupported language: {language_id!r}. "
                         f"Available: {list(LANGUAGE_REGISTRY)}")
    return LANGUAGE_REGISTRY[language_id]
