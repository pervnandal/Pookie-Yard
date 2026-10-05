from typing import Optional
from datetime import datetime
from fastapi import APIRouter
from pydantic import BaseModel
from backend.config import supabase

router = APIRouter(prefix="/api")

class ItineraryCreate(BaseModel):
    title: str

class ItineraryUpdate(BaseModel):
    content: Optional[str] = None
    title: Optional[str] = None

@router.get("/chats")
def get_chats():
    if not supabase: return []
    resp = supabase.table("chat_messages").select("*").order("created_at", desc=False).execute()
    return resp.data

@router.get("/itineraries")
def get_itineraries():
    if not supabase: return []
    resp = supabase.table("itineraries").select("*").order("updated_at", desc=True).execute()
    return resp.data

@router.post("/itineraries")
def create_itinerary(req: ItineraryCreate):
    resp = supabase.table("itineraries").insert({"title": req.title, "content": ""}).execute()
    return resp.data[0]

@router.put("/itineraries/{doc_id}")
def update_itinerary(doc_id: int, req: ItineraryUpdate):
    update_data = {"updated_at": datetime.now().isoformat()}
    if req.content is not None: update_data["content"] = req.content
    if req.title is not None: update_data["title"] = req.title
    supabase.table("itineraries").update(update_data).eq("id", doc_id).execute()
    return {"success": True}

@router.delete("/itineraries/{doc_id}")
def delete_itinerary(doc_id: int):
    supabase.table("itineraries").delete().eq("id", doc_id).execute()
    return {"success": True}