from fastapi import APIRouter

from app.api.v1 import documents, sessions, exercises, execution, budget, ws, topics, settings

api_router = APIRouter()

api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(sessions.router, prefix="/sessions", tags=["sessions"])
api_router.include_router(exercises.router, prefix="/exercises", tags=["exercises"])
api_router.include_router(execution.router, prefix="/execute", tags=["execution"])
api_router.include_router(budget.router, prefix="/budget", tags=["budget"])
api_router.include_router(ws.router, prefix="/ws", tags=["websocket"])
api_router.include_router(topics.router, prefix="/topics", tags=["topics"])
api_router.include_router(settings.router, prefix="/settings", tags=["settings"])
