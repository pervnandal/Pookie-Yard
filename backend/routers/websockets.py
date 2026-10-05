import json
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from backend.services.ws_manager import manager

router = APIRouter(prefix="/ws")

@router.websocket("/chat")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            
            # We ONLY broadcast the live typing/chat events to the screens.
            # We NO LONGER save to the database here, because the frontend 
            # now explicitly sends a POST request to '/api/chats' to save it safely.
            await manager.broadcast(data)
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)