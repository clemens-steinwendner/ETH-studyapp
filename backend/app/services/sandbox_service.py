"""
E2B sandbox execution wrapper (FR-14, FR-19, FR-20).

Bundles user code with generated test cases, provisions a microVM,
runs the test harness, and returns structured output.
"""
import asyncio
import time
from pathlib import Path

from jinja2 import Template

from app.sandbox.languages import get_config
from app.schemas.execution import ExecutionRequest, ExecutionResult

_TEMPLATES_DIR = Path(__file__).parent.parent / "sandbox" / "templates"


def _get_schema_sql() -> str:
    """Load the default SQL schema for the databases course (FR-19)."""
    from app.sandbox.configs.sql import get_schema_sql
    return get_schema_sql()


def _run_sync(body: ExecutionRequest) -> ExecutionResult:
    """Synchronous E2B execution — called via run_in_executor to stay non-blocking."""
    from e2b_code_interpreter import CodeInterpreter
    from app.config import settings

    config = get_config(body.language)

    # Render test harness from Jinja2 template
    template_path = _TEMPLATES_DIR / config.runner_template
    rendered = Template(template_path.read_text()).render(
        user_code=body.user_code,
        test_cases=body.test_cases or "",
        schema_sql=_get_schema_sql() if body.language == "sql" else "",
    )

    # Import language-specific setup config
    if body.language == "python":
        from app.sandbox.configs.python import SETUP_COMMANDS, RUNNER_COMMAND
    elif body.language == "sql":
        from app.sandbox.configs.sql import SETUP_COMMANDS, RUNNER_COMMAND
    elif body.language == "haskell":
        from app.sandbox.configs.haskell import SETUP_COMMANDS, RUNNER_COMMAND
    else:
        SETUP_COMMANDS = []
        RUNNER_COMMAND = f"python solution{config.file_extension}"

    start = time.monotonic()
    stdout = ""
    stderr = ""
    exit_code = 1

    try:
        with CodeInterpreter(api_key=settings.e2b_api_key) as sbx:
            # Write the rendered code file to the sandbox filesystem
            file_name = f"solution{config.file_extension}"
            sbx.filesystem.write(f"/home/user/{file_name}", rendered)

            # Run setup commands (e.g. pip install pytest)
            for cmd in SETUP_COMMANDS:
                sbx.process.start_and_wait(cmd)

            # Run the test harness
            proc = sbx.process.start_and_wait(
                f"cd /home/user && {RUNNER_COMMAND}",
                timeout=30,
            )
            stdout = proc.stdout or ""
            stderr = proc.stderr or ""
            exit_code = proc.exit_code if proc.exit_code is not None else 1

    except Exception as exc:
        stderr = f"Sandbox error: {exc}"
        exit_code = 1

    duration_ms = int((time.monotonic() - start) * 1000)
    return ExecutionResult(
        stdout=stdout,
        stderr=stderr,
        exit_code=exit_code,
        passed=(exit_code == 0),
        duration_ms=duration_ms,
    )


async def run_in_sandbox(body: ExecutionRequest) -> ExecutionResult:
    """
    Execute user code + test cases in an E2B microVM.

    Runs synchronous E2B SDK calls in a thread executor to avoid blocking
    the FastAPI event loop.
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _run_sync, body)
