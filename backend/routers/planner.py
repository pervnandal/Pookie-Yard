import os
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional

try:
    from backend.config import supabase
except ImportError:
    try:
        from config import supabase
    except ImportError:
        from supabase import create_client
        supabase = create_client(os.getenv("SUPABASE_URL", ""), os.getenv("SUPABASE_KEY", ""))

router = APIRouter(prefix="/api")

class CreateItineraryRequest(BaseModel):
    title: str

class UpdateItineraryRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None

@router.get("/chats")
def get_chats(
    limit: int = Query(25, ge=1, le=100),
    before_id: Optional[int] = Query(None, description="Fetch chunk of messages older than this message ID")
):
    """
    Returns chat messages in chunks (default 25).
    - Initial call (no before_id): returns the latest `limit` messages in chronological order.
    - Scroll-up call (with before_id): returns the `limit` messages immediately preceding `before_id`.
    """
    if not supabase:
        return []
    try:
        query = supabase.table("chat_messages").select("*")
        if before_id is not None:
            query = query.lt("id", before_id)

        # Fetch newest-first so limit grabs the most recent chunk, then reverse to chronological order
        resp = query.order("id", desc=True).limit(limit).execute()
        rows = resp.data or []
        rows.reverse()
        return rows
    except Exception as e:
        print(f"Error fetching chats chunk: {e}")
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
    update_data = req.model_dump(exclude_none=True) if hasattr(req, "model_dump") else req.dict(exclude_none=True)
    resp = supabase.table("itineraries").update(update_data).eq("id", doc_id).execute()
    return resp.data[0] if resp.data else {"status": "updated"}

@router.delete("/itineraries/{doc_id}")
def delete_itinerary(doc_id: str):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not connected")
    supabase.table("itineraries").delete().eq("id", doc_id).execute()
    return {"status": "deleted"}