import gc
import os
import asyncio
from fastapi import APIRouter, HTTPException, Query, UploadFile, File
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

try:
    from backend.services.google_cloud import get_drive_service, upload_to_drive, upload_to_youtube
except ImportError:
    from services.google_cloud import get_drive_service, upload_to_drive, upload_to_youtube

router = APIRouter(prefix="/api")

class CreateItineraryRequest(BaseModel):
    title: str

class UpdateItineraryRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None


def _upload_chat_media_sync(f: UploadFile) -> dict:
    mime = (f.content_type or "").lower()
    fname = f.filename or "chat_media"
    is_video = mime.startswith("video/") or fname.lower().endswith((".mp4", ".mov", ".webm", ".mkv", ".avi"))
    is_audio = mime.startswith("audio/") or fname.lower().endswith((".mp3", ".wav", ".ogg", ".m4a", ".aac"))

    if is_video:
        file_url = upload_to_youtube(
            f.file,
            title=f"Chat Video - {fname}",
            description="Shared in The Us Space Live Chat",
            mime_type=mime or "video/mp4"
        )
        media_type = "video"
    else:
        drive_service = get_drive_service()
        file_url = upload_to_drive(
            f.file,
            filename=fname,
            mime_type=mime or ("audio/webm" if is_audio else "image/jpeg"),
            drive_service=drive_service
        )
        media_type = "audio" if is_audio else "image"

    return {
        "file_url": file_url,
        "media_type": media_type,
        "name": fname
    }


@router.post("/chats/upload")
async def upload_chat_media(file: UploadFile = File(...)):
    """Uploads an image, video, or audio attachment for Live Planner chat."""
    try:
        result = await asyncio.to_thread(_upload_chat_media_sync, file)
        await file.close()
        gc.collect()
        return result
    except Exception as e:
        print(f"Chat media upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Chat media upload failed: {str(e)}")


@router.get("/chats")
def get_chats(
    limit: int = Query(25, ge=1, le=100),
    before_id: Optional[int] = Query(None, description="Fetch chunk of messages older than this message ID")
):
    if not supabase:
        return []
    try:
        query = supabase.table("chat_messages").select("*")
        if before_id is not None:
            query = query.lt("id", before_id)

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
