from arq.connections import RedisSettings

from app.config import settings
from app.tasks.ingest_task import ingest_document


async def startup(ctx: dict) -> None:
    """Pre-warm the local embedding model so the first ingest job doesn't hit a cold download."""
    import asyncio
    from functools import partial
    from app.services.ingestion.embedder import embed_texts
    loop = asyncio.get_event_loop()
    # Run in executor to avoid blocking the event loop during model load
    await loop.run_in_executor(None, partial(embed_texts, ["warmup"]))


class WorkerSettings:
    functions = [ingest_document]
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    on_startup = startup
    max_jobs = 4
    job_timeout = 600  # 10 min — covers first-run model download + large PDF + exam profile extraction
