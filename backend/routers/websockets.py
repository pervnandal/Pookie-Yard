import json
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from backend.services.ws_manager import manager
from backend.config import supabase

router = APIRouter(prefix="/ws")

# Track recently saved message IDs in memory to prevent duplicate DB inserts
_recent_msg_ids = set()

def save_chat_to_db(data: dict):
    if not supabase:
        return
    try:
        msg_id = data.get("id")
        if msg_id:
            if msg_id in _recent_msg_ids:
                return
            _recent_msg_ids.add(msg_id)
            if len(_recent_msg_ids) > 500:
                _recent_msg_ids.pop()

        supabase.table("chat_messages").insert({
            "sender_id": data.get("senderId") or data.get("sender_id"),
            "text": data.get("text", ""),
            "audio": data.get("audio", ""),
            "timestamp": data.get("timestamp", "")
        }).execute()
    except Exception as e:
        print(f"WebSocket DB save error: {e}")

@router.websocket("/chat")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            raw_data = await websocket.receive_text()
            
            # 1. Broadcast immediately to all connected clients for instant live updates
            await manager.broadcast(raw_data)
            
            # 2. If it's a chat message, save it to Supabase in a non-blocking thread
            try:
                parsed = json.loads(raw_data)
                if parsed.get("type") == "chat":
                    asyncio.create_task(asyncio.to_thread(save_chat_to_db, parsed))
            except Exception as e:
                print(f"WS parse error: {e}")
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)

# import json
# import asyncio
# from fastapi import APIRouter, WebSocket, WebSocketDisconnect
# from backend.services.ws_manager import manager

# router = APIRouter(prefix="/ws")

# @router.websocket("/chat")
# async def websocket_endpoint(websocket: WebSocket):
#     await manager.connect(websocket)
#     try:
#         while True:
#             data = await websocket.receive_text()
            
#             # We ONLY broadcast the live typing/chat events to the screens.
#             # We NO LONGER save to the database here, because the frontend 
#             # now explicitly sends a POST request to '/api/chats' to save it safely.
#             await manager.broadcast(data)
            
#     except WebSocketDisconnect:
#         manager.disconnect(websocket)

# import json
# import asyncio
# from fastapi import APIRouter, WebSocket, WebSocketDisconnect
# from backend.services.ws_manager import manager
# from backend.database import supabase

# router = APIRouter(prefix="/ws")

# # Track recently saved message IDs in memory to prevent duplicate DB inserts
# _recent_msg_ids = set()

# def save_chat_to_db(data: dict):
#     if not supabase:
#         return
#     try:
#         msg_id = data.get("id")
#         if msg_id:
#             if msg_id in _recent_msg_ids:
#                 return
#             _recent_msg_ids.add(msg_id)
#             if len(_recent_msg_ids) > 500:
#                 _recent_msg_ids.pop()

#         supabase.table("chat_messages").insert({
#             "sender_id": data.get("senderId") or data.get("sender_id"),
#             "text": data.get("text", ""),
#             "audio": data.get("audio", ""),
#             "timestamp": data.get("timestamp", "")
#         }).execute()
#     except Exception as e:
#         print(f"WebSocket DB save error: {e}")

# @router.websocket("/chat")
# async def websocket_endpoint(websocket: WebSocket):
#     await manager.connect(websocket)
#     try:
#         while True:
#             raw_data = await websocket.receive_text()
            
#             # 1. Broadcast immediately to all connected clients for instant live updates
#             await manager.broadcast(raw_data)
            
#             # 2. If it's a chat message, save it to Supabase in a non-blocking thread
#             try:
#                 parsed = json.loads(raw_data)
#                 if parsed.get("type") == "chat":
#                     asyncio.create_task(asyncio.to_thread(save_chat_to_db, parsed))
#             except Exception as e:
#                 print(f"WS parse error: {e}")
                
#     except WebSocketDisconnect:
#         manager.disconnect(websocket)
#     except Exception:
#         manager.disconnect(websocket)