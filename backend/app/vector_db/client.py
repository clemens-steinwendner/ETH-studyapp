from functools import lru_cache

import chromadb

from app.config import settings


@lru_cache(maxsize=1)
def get_chroma_client() -> chromadb.PersistentClient:
    return chromadb.PersistentClient(path=settings.chroma_persist_dir)
