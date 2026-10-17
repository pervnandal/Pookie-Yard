from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from backend.config import supabase

router = APIRouter(prefix="/api")

class CreateItineraryRequest(BaseModel):
    title: str

class UpdateItineraryRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None

@router.get("/chats")
def get_chats():
    if not supabase:
        return []
    try:
        resp = supabase.table("chat_messages").select("*").order("id", desc=False).limit(200).execute()
        return resp.data or []
    except Exception as e:
        print(f"Error fetching chats: {e}")
        return []

@router.get("/itineraries")
def get_itineraries():
    if not supabase:
        return []
    try:
        resp = supabase.table("itineraries").select("*").order("id", desc=True).execute()
        return resp.data or []
    except Exception as e:
        print(f"Error fetching itineraries: {e}")
        return []

@router.post("/itineraries")
def create_itinerary(req: CreateItineraryRequest):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not connected")
    resp = supabase.table("itineraries").insert({
        "title": req.title,
        "content": ""
    }).execute()
    return resp.data[0] if resp.data else {}

@router.put("/itineraries/{doc_id}")
def update_itinerary(doc_id: str, req: UpdateItineraryRequest):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not connected")
    update_data = req.model_dump(exclude_none=True)
    resp = supabase.table("itineraries").update(update_data).eq("id", doc_id).execute()
    return resp.data[0] if resp.data else {"status": "updated"}

@router.delete("/itineraries/{doc_id}")
def delete_itinerary(doc_id: str):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not connected")
    supabase.table("itineraries").delete().eq("id", doc_id).execute()
    return {"status": "deleted"}

# from typing import Optional
# from datetime import datetime
# from fastapi import APIRouter
# from pydantic import BaseModel
# from backend.config import supabase

# router = APIRouter(prefix="/api")

# class ItineraryCreate(BaseModel):
#     title: str

# class ItineraryUpdate(BaseModel):
#     content: Optional[str] = None
#     title: Optional[str] = None

# @router.get("/chats")
# def get_chats():
#     if not supabase: return []
#     resp = supabase.table("chat_messages").select("*").order("created_at", desc=False).execute()
#     return resp.data

# @router.get("/itineraries")
# def get_itineraries():
#     if not supabase: return []
#     resp = supabase.table("itineraries").select("*").order("updated_at", desc=True).execute()
#     return resp.data

# @router.post("/itineraries")
# def create_itinerary(req: ItineraryCreate):
#     resp = supabase.table("itineraries").insert({"title": req.title, "content": ""}).execute()
#     return resp.data[0]

# @router.put("/itineraries/{doc_id}")
# def update_itinerary(doc_id: int, req: ItineraryUpdate):
#     update_data = {"updated_at": datetime.now().isoformat()}
#     if req.content is not None: update_data["content"] = req.content
#     if req.title is not None: update_data["title"] = req.title
#     supabase.table("itineraries").update(update_data).eq("id", doc_id).execute()
#     return {"success": True}

# @router.delete("/itineraries/{doc_id}")
# def delete_itinerary(doc_id: int):
#     supabase.table("itineraries").delete().eq("id", doc_id).execute()
#     return {"success": True}

# class ChatMessage(BaseModel):
#     sender_id: str
#     text: str
#     audio: str = ""
#     timestamp: str

# @router.post("/chats")
# def save_chat(req: ChatMessage):
#     if not supabase: 
#         return {"success": False}
#     resp = supabase.table("chat_messages").insert({
#         "sender_id": req.sender_id,
#         "text": req.text,
#         "audio": req.audio,
#         "timestamp": req.timestamp
#     }).execute()
#     return resp.data[0] if resp.data else {"success": True}