import json
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from backend.services.ws_manager import manager
from backend.config import supabase

router = APIRouter(prefix="/ws")

def save_chat_to_db(parsed_data):
    if supabase:
        try:
            supabase.table("chat_messages").insert({
                "sender_id": parsed_data.get("senderId", ""),
                "text": parsed_data.get("text", ""),
                "audio": parsed_data.get("audio", ""),
                "timestamp": parsed_data.get("timestamp", "")
            }).execute()
        except Exception as e:
            print("Failed to save chat:", e)

@router.websocket("/chat")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            parsed_data = json.loads(data)
            
            if parsed_data.get("type") == "chat":
                asyncio.create_task(asyncio.to_thread(save_chat_to_db, parsed_data))
                    
            await manager.broadcast(data)
    except WebSocketDisconnect:
        manager.disconnect(websocket)