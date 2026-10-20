import gc
import io
import os
import re
import time
import asyncio
import zipfile
import threading
import requests
from fastapi import (
    APIRouter,
    UploadFile,
    File,
    Form,
    HTTPException,
    Response,
    Request,
    Query,
)
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

        supabase = create_client(
            os.getenv("SUPABASE_URL", ""), os.getenv("SUPABASE_KEY", "")
        )

try:
    from backend.services.google_cloud import (
        get_drive_service,
        upload_to_drive,
        upload_to_youtube,
        delete_media_from_cloud,
        download_original_from_drive,
        fetch_drive_file_bytes,
    )
except ImportError:
    from services.google_cloud import (
        get_drive_service,
        upload_to_drive,
        upload_to_youtube,
        delete_media_from_cloud,
        download_original_from_drive,
        fetch_drive_file_bytes,
    )

router = APIRouter(prefix="/api")

_recent_album_creations = {}


class UpdateMemoryRequest(BaseModel):
    description: Optional[str] = None
    title: Optional[str] = None
    memory_date: Optional[str] = None
    is_private: Optional[bool] = None


class MoveMediaRequest(BaseModel):
    target_memory_id: str


def _background_warm_cache(memories_list: list):
    for mem in memories_list[:6]:
        for media in (mem.get("memory_media") or [])[:8]:
            raw_url = media.get("file_url", "")
            if raw_url.startswith(("voice#", "video#")) or "youtube.com" in raw_url:
                continue
            m = re.search(r"(?:id=|/d/|drive-image/)([a-zA-Z0-9_-]+)", raw_url)
            if m:
                try:
                    fetch_drive_file_bytes(m.group(1), size="thumb")
                except Exception:
                    pass


def _upload_single_file_sync(
    f: UploadFile, title: str, description: str, drive_service
) -> Optional[str]:
    clean_desc = re.sub(r"\n?<!--US_META:[\s\S]*?-->", "", description or "").strip()
    mime = (f.content_type or "").lower()
    fname = f.filename or "memory_file"
    if mime.startswith("video/") or fname.lower().endswith(
        (".mp4", ".mov", ".webm", ".mkv", ".avi")
    ):
        return upload_to_youtube(
            f.file,
            title=f"{title} - {fname}",
            description=clean_desc,
            mime_type=mime or "video/mp4",
        )
    return upload_to_drive(
        f.file,
        filename=fname,
        mime_type=mime or "image/jpeg",
        drive_service=drive_service,
    )


@router.get("/drive-image/{file_id}")
async def stream_drive_media(
    file_id: str,
    request: Request,
    size: str = Query("original", description="thumb, preview, or original"),
):
    etag = f'"{file_id}-{size}"'
    if request.headers.get("if-none-match") == etag:
        return Response(
            status_code=304,
            headers={
                "ETag": etag,
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        )

    try:
        raw_bytes, filename, mime_type = await asyncio.to_thread(
            fetch_drive_file_bytes, file_id, size
        )
        return Response(
            content=raw_bytes,
            media_type=mime_type,
            headers={
                "ETag": etag,
                "Cache-Control": "public, max-age=31536000, immutable",
                "Access-Control-Allow-Origin": "*",
                "Content-Disposition": f'inline; filename="{filename}"',
            },
        )
    except Exception as e:
        print(f"Error streaming drive file {file_id} ({size}): {e}")
        raise HTTPException(status_code=404, detail="Media file not found on Drive")


@router.get("/memories")
def get_memories(limit: int = 50, offset: int = 0):
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
            threading.Thread(
                target=_background_warm_cache, args=(data,), daemon=True
            ).start()
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
    files: List[UploadFile] = File(default=[]),
):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not connected")

    try:
        dedup_key = (title.strip().lower(), memory_date.strip())
        now_ts = time.time()
        memory_id = None

        if dedup_key in _recent_album_creations:
            prev_ts, prev_id = _recent_album_creations[dedup_key]
            if now_ts - prev_ts < 15:
                memory_id = prev_id

        if not memory_id:
            try:
                mem_resp = (
                    supabase.table("memories")
                    .insert(
                        {
                            "title": title,
                            "memory_date": memory_date,
                            "description": description,
                            "is_private": is_private,
                        }
                    )
                    .execute()
                )
            except Exception:
                mem_resp = (
                    supabase.table("memories")
                    .insert(
                        {
                            "title": title,
                            "memory_date": memory_date,
                            "description": description,
                        }
                    )
                    .execute()
                )

            if not mem_resp.data:
                raise HTTPException(
                    status_code=500, detail="Failed to create memory record"
                )

            memory_id = mem_resp.data[0]["id"]
            _recent_album_creations[dedup_key] = (now_ts, memory_id)

        media_records = []
        has_non_video = any(
            not (
                (f.content_type or "").lower().startswith("video/")
                or (f.filename or "")
                .lower()
                .endswith((".mp4", ".mov", ".webm", ".mkv", ".avi"))
            )
            for f in files
            if f.filename
        )
        drive_service = (
            await asyncio.to_thread(get_drive_service) if has_non_video else None
        )

        for f in files:
            if not f.filename:
                continue
            file_url = await asyncio.to_thread(
                _upload_single_file_sync, f, title, description, drive_service
            )
            await f.close()
            if file_url:
                media_records.append({"memory_id": memory_id, "file_url": file_url})
            gc.collect()

        if media_records:
            supabase.table("memory_media").insert(media_records).execute()

        full_mem = (
            supabase.table("memories")
            .select("*, memory_media(*)")
            .eq("id", memory_id)
            .execute()
        )
        return (
            full_mem.data[0]
            if full_mem.data
            else {
                "id": memory_id,
                "title": title,
                "memory_date": memory_date,
                "memory_media": [],
            }
        )

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
        mem = (
            supabase.table("memories")
            .select("title, description")
            .eq("id", memory_id)
            .execute()
        )
        title = mem.data[0].get("title", "Memory") if mem.data else "Memory"
        desc = mem.data[0].get("description", "") if mem.data else ""

        media_records = []
        has_non_video = any(
            not (
                (f.content_type or "").lower().startswith("video/")
                or (f.filename or "")
                .lower()
                .endswith((".mp4", ".mov", ".webm", ".mkv", ".avi"))
            )
            for f in files
            if f.filename
        )
        drive_service = (
            await asyncio.to_thread(get_drive_service) if has_non_video else None
        )

        for f in files:
            if not f.filename:
                continue
            file_url = await asyncio.to_thread(
                _upload_single_file_sync, f, title, desc, drive_service
            )
            await f.close()
            if file_url:
                media_records.append({"memory_id": memory_id, "file_url": file_url})
            gc.collect()

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
    update_data = (
        req.model_dump(exclude_none=True)
        if hasattr(req, "model_dump")
        else req.dict(exclude_none=True)
    )
    try:
        resp = (
            supabase.table("memories").update(update_data).eq("id", memory_id).execute()
        )
        return resp.data
    except Exception:
        # Fallback if is_private column is not in memories table
        update_data.pop("is_private", None)
        resp = (
            supabase.table("memories").update(update_data).eq("id", memory_id).execute()
        )
        return resp.data


def _resolve_media_row(media_id: str):
    """Safely resolves a memory_media row whether media_id is a numeric bigint ID or a Drive/YouTube string ID."""
    if not supabase:
        return None
    if str(media_id).isdigit():
        resp = (
            supabase.table("memory_media").select("*").eq("id", int(media_id)).execute()
        )
        if resp.data:
            return resp.data[0]
    resp = (
        supabase.table("memory_media")
        .select("*")
        .ilike("file_url", f"%{media_id}%")
        .limit(1)
        .execute()
    )
    return resp.data[0] if resp.data else None


@router.put("/media/{media_id}/move")
def move_media_between_albums(media_id: str, req: MoveMediaRequest):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not connected")
    row = _resolve_media_row(media_id)
    if not row:
        raise HTTPException(status_code=404, detail="Media record not found")
    resp = (
        supabase.table("memory_media")
        .update({"memory_id": req.target_memory_id})
        .eq("id", row["id"])
        .execute()
    )
    return {"status": "moved", "data": resp.data}


@router.delete("/media/{media_id}")
async def delete_single_media(media_id: str):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not connected")

    row = _resolve_media_row(media_id)
    if row:
        file_url = row.get("file_url")
        if file_url:
            await asyncio.to_thread(delete_media_from_cloud, file_url)
        supabase.table("memory_media").delete().eq("id", row["id"]).execute()
    return {"status": "deleted"}


@router.delete("/memories/{memory_id}")
async def delete_entire_memory(memory_id: str):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not connected")

    media_resp = (
        supabase.table("memory_media")
        .select("file_url")
        .eq("memory_id", memory_id)
        .execute()
    )
    if media_resp.data:
        for item in media_resp.data:
            file_url = item.get("file_url")
            if file_url:
                await asyncio.to_thread(delete_media_from_cloud, file_url)

    supabase.table("memory_media").delete().eq("memory_id", memory_id).execute()
    supabase.table("memories").delete().eq("id", memory_id).execute()
    return {"status": "album_deleted"}


@router.get("/media/{media_id}/download")
async def download_single_media_original(media_id: str):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not connected")

    row = _resolve_media_row(media_id)
    raw_url = row.get("file_url", "") if row else ""

    # If media_id itself was a Google Drive ID and not found in DB, construct Drive URL directly
    if not raw_url and not str(media_id).isdigit():
        raw_url = f"https://drive.google.com/uc?id={media_id}&export=download"

    if not raw_url:
        raise HTTPException(status_code=404, detail="Media not found")

    try:
        buffer, filename, mime_type = await asyncio.to_thread(
            download_original_from_drive, raw_url
        )
        if buffer:
            return StreamingResponse(
                buffer,
                media_type=mime_type,
                headers={"Content-Disposition": f'attachment; filename="{filename}"'},
            )
    except Exception as e:
        print(f"Direct download fallback: {e}")

    clean_url = raw_url.replace("voice#", "").replace("video#", "")
    return RedirectResponse(clean_url)


@router.get("/memories/{memory_id}/download")
async def download_album_zip(memory_id: str):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not connected")

    media_resp = (
        supabase.table("memory_media").select("*").eq("memory_id", memory_id).execute()
    )
    media_list = media_resp.data or []

    def _build_zip():
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
                    print(f"Zip download fallback for item {idx}: {e}")

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
        return zip_buffer

    zip_buffer = await asyncio.to_thread(_build_zip)
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="album_{memory_id}_original.zip"'
        },
    )


try:
    from backend.routers.widget import router as widget_router

    router.include_router(widget_router)
except ImportError:
    try:
        from routers.widget import router as widget_router

        router.include_router(widget_router)
    except Exception:
        pass
