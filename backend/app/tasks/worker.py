from arq import create_pool
from arq.connections import RedisSettings

from app.config import settings
from app.tasks.ingest_task import ingest_document


class WorkerSettings:
    functions = [ingest_document]
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    max_jobs = 4
    job_timeout = 120  # seconds — covers NFR-03 (60s ingestion) with headroom
