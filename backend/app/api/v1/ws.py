from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()


@router.websocket("/stream/{session_id}")
async def stream_tokens(websocket: WebSocket, session_id: int) -> None:
    """WebSocket endpoint that relays LLM token stream to the frontend (NFR-01)."""
    await websocket.accept()
    try:
        # TODO: wire up llm.streaming.relay_to_websocket(websocket, session_id)
        await websocket.send_text("Not yet implemented")
    except WebSocketDisconnect:
        pass
