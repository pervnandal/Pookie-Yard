import io
import os
import re
import asyncio
import zipfile
import threading
import requests
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Response, Request, Query
from fastapi.responses import StreamingResponse, RedirectResponse
from typing import List, Optional
from pydantic import BaseModel

try:
    from backend.config import supabase
except ImportError:
    try:
        from config import supabase
    except ImportError:
        from supabase import create_client
        supabase = create_client(os.getenv("SUPABASE_URL", ""), os.getenv("SUPABASE_KEY", ""))

try:
    from backend.services.google_cloud import (
        get_drive_service,
        upload_to_drive,
        upload_to_youtube,
        delete_media_from_cloud,
        download_original_from_drive,
        fetch_drive_file_bytes
    )
except ImportError:
    from services.google_cloud import (
        get_drive_service,
        upload_to_drive,
        upload_to_youtube,
        delete_media_from_cloud,
        download_original_from_drive,
        fetch_drive_file_bytes
    )

router = APIRouter(prefix="/api")


class UpdateMemoryRequest(BaseModel):
    description: Optional[str] = None
    title: Optional[str] = None


def _background_warm_cache(memories_list: list):
    """Silently pre-warms thumbnails on disk in the background so folders and galleries open in 0ms."""
    for mem in memories_list[:6]:
        for media in (mem.get("memory_media") or [])[:12]:
            raw_url = media.get("file_url", "")
            if raw_url.startswith(("voice#", "video#")) or "youtube.com" in raw_url:
                continue
            m = re.search(r"(?:id=|/d/|drive-image/)([a-zA-Z0-9_-]+)", raw_url)
            if m:
                fid = m.group(1)
                try:
                    fetch_drive_file_bytes(fid, size="thumb")
                except Exception:
                    pass


@router.get("/drive-image/{file_id}")
async def stream_drive_media(
    file_id: str,
    request: Request,
    size: str = Query("original", description="thumb, preview, or original")
):
    etag = f'"{file_id}-{size}"'
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers={"ETag": etag, "Cache-Control": "public, max-age=31536000, immutable"})

    try:
        raw_bytes, filename, mime_type = await asyncio.to_thread(fetch_drive_file_bytes, file_id, size)
        return Response(
            content=raw_bytes,
            media_type=mime_type,
            headers={
                "ETag": etag,
                "Cache-Control": "public, max-age=31536000, immutable",
                "Access-Control-Allow-Origin": "*",
                "Content-Disposition": f'inline; filename="{filename}"'
            }
        )
    except Exception as e:
        print(f"Error streaming drive file {file_id} ({size}): {e}")
        raise HTTPException(status_code=404, detail="Media file not found on Drive")


@router.get("/memories")
def get_memories(limit: int = 24, offset: int = 0):
    if not supabase:
        return []
    try:
        resp = (
            supabase.table("memories")
            .select("*, memory_media(*)")
            .order("memory_date", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        data = resp.data or []
        if data and offset == 0:
            threading.Thread(target=_background_warm_cache, args=(data,), daemon=True).start()
        return data
    except Exception as e:
        print(f"get_memories error: {e}")
        return []


@router.post("/memories")
async def create_memory(
    title: str = Form(...),
    memory_date: str = Form(...),
    description: str = Form(""),
    is_private: bool = Form(False),
    files: List[UploadFile] = File(default=[])
):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not connected")

    try:
        try:
            mem_resp = supabase.table("memories").insert({
                "title": title,
                "memory_date": memory_date,
                "description": description,
                "is_private": is_private
            }).execute()
        except Exception:
            mem_resp = supabase.table("memories").insert({
                "title": title,
                "memory_date": memory_date,
                "description": description
            }).execute()

        if not mem_resp.data:
            raise HTTPException(status_code=500, detail="Failed to create memory record")

        memory_id = mem_resp.data[0]["id"]
        media_records = []
        drive_service = get_drive_service() if files else None

        for f in files:
            content = await f.read()
            if not content:
                continue
            file_obj = io.BytesIO(content)
            mime = (f.content_type or "").lower()
            fname = f.filename or "memory_file"

            if mime.startswith("video/") or fname.lower().endswith((".mp4", ".mov", ".webm", ".mkv")):
                file_url = upload_to_youtube(file_obj, title=f"{title} - {fname}", description=description, mime_type=mime or "video/mp4")
            else:
                file_url = upload_to_drive(file_obj, filename=fname, mime_type=mime or "image/jpeg", drive_service=drive_service)

            media_records.append({
                "memory_id": memory_id,
                "file_url": file_url
            })

        if media_records:
            supabase.table("memory_media").insert(media_records).execute()

        full_mem = supabase.table("memories").select("*, memory_media(*)").eq("id", memory_id).execute()
        return full_mem.data[0] if full_mem.data else mem_resp.data[0]

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating memory: {e}")
        raise HTTPException(status_code=500, detail=f"Upload error: {str(e)}")


@router.post("/memories/{memory_id}/media")
async def add_media_to_memory(memory_id: str, files: List[UploadFile] = File(...)):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not connected")

    try:
        mem = supabase.table("memories").select("title, description").eq("id", memory_id).execute()
        title = mem.data[0].get("title", "Memory") if mem.data else "Memory"
        desc = mem.data[0].get("description", "") if mem.data else ""

        media_records = []
        drive_service = get_drive_service() if files else None

        for f in files:
            content = await f.read()
            if not content:
                continue
            file_obj = io.BytesIO(content)
            mime = (f.content_type or "").lower()
            fname = f.filename or "memory_file"

            if mime.startswith("video/") or fname.lower().endswith((".mp4", ".mov", ".webm", ".mkv")):
                file_url = upload_to_youtube(file_obj, title=f"{title} - {fname}", description=desc, mime_type=mime or "video/mp4")
            else:
                file_url = upload_to_drive(file_obj, filename=fname, mime_type=mime or "image/jpeg", drive_service=drive_service)

            media_records.append({
                "memory_id": memory_id,
                "file_url": file_url
            })

        if media_records:
            supabase.table("memory_media").insert(media_records).execute()

        return {"status": "success", "added": len(media_records)}
    except Exception as e:
        print(f"Error adding media: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload media: {str(e)}")


@router.put("/memories/{memory_id}")
def update_memory(memory_id: str, req: UpdateMemoryRequest):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not connected")
    update_data = req.model_dump(exclude_none=True) if hasattr(req, "model_dump") else req.dict(exclude_none=True)
    resp = supabase.table("memories").update(update_data).eq("id", memory_id).execute()
    return resp.data


@router.delete("/media/{media_id}")
def delete_single_media(media_id: str):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not connected")

    media_resp = supabase.table("memory_media").select("*").eq("id", media_id).execute()
    if media_resp.data:
        file_url = media_resp.data[0].get("file_url")
        delete_media_from_cloud(file_url)

    supabase.table("memory_media").delete().eq("id", media_id).execute()
    return {"status": "deleted"}


@router.delete("/memories/{memory_id}")
def delete_entire_memory(memory_id: str):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not connected")

    media_resp = supabase.table("memory_media").select("file_url").eq("memory_id", memory_id).execute()
    if media_resp.data:
        for item in media_resp.data:
            delete_media_from_cloud(item.get("file_url"))

    supabase.table("memory_media").delete().eq("memory_id", memory_id).execute()
    supabase.table("memories").delete().eq("id", memory_id).execute()
    return {"status": "album_deleted"}


@router.get("/media/{media_id}/download")
def download_single_media_original(media_id: str):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not connected")

    media_resp = supabase.table("memory_media").select("*").eq("id", media_id).execute()
    if not media_resp.data:
        raise HTTPException(status_code=404, detail="Media not found")

    raw_url = media_resp.data[0].get("file_url", "")
    try:
        buffer, filename, mime_type = download_original_from_drive(raw_url)
        if buffer:
            return StreamingResponse(
                buffer,
                media_type=mime_type,
                headers={"Content-Disposition": f'attachment; filename="{filename}"'}
            )
    except Exception as e:
        print(f"Direct Drive API download fallback: {e}")

    clean_url = raw_url.replace("voice#", "").replace("video#", "")
    return RedirectResponse(clean_url)


@router.get("/memories/{memory_id}/download")
def download_album_zip(memory_id: str):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not connected")

    media_resp = supabase.table("memory_media").select("*").eq("memory_id", memory_id).execute()
    media_list = media_resp.data or []

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_STORED) as zip_file:
        for idx, m in enumerate(media_list):
            raw_url = m.get("file_url", "")
            try:
                buffer, filename, _ = download_original_from_drive(raw_url)
                if buffer:
                    zip_file.writestr(f"{idx+1:02d}_{filename}", buffer.read())
                    continue
            except Exception as e:
                print(f"Zip Drive API fallback for item {idx}: {e}")

            is_voice = raw_url.startswith("voice#")
            is_video = raw_url.startswith("video#")
            url = raw_url.replace("voice#", "").replace("video#", "")
            if "youtube.com" in url or "youtu.be" in url:
                continue
            try:
                r = requests.get(url, timeout=20)
                if r.status_code == 200:
                    ext = "webm" if is_voice else ("mp4" if is_video else "jpg")
                    zip_file.writestr(f"memory_{idx+1:02d}.{ext}", r.content)
            except Exception:
                pass

    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="album_{memory_id}_original.zip"'}
    )