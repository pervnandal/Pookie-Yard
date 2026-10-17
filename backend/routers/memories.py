import io
import zipfile
import requests
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse
from typing import List, Optional
from pydantic import BaseModel
from backend.config import supabase
from backend.services.google_cloud import (
    upload_to_drive,
    upload_to_youtube,
    delete_media_from_cloud
)

router = APIRouter(prefix="/api")

class UpdateMemoryRequest(BaseModel):
    description: Optional[str] = None
    title: Optional[str] = None

@router.get("/memories")
def get_memories(limit: int = 12, offset: int = 0):
    if not supabase:
        return []
    resp = (
        supabase.table("memories")
        .select("*, memory_media(*)")
        .order("memory_date", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return resp.data or []

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

    mem_resp = supabase.table("memories").insert({
        "title": title,
        "memory_date": memory_date,
        "description": description,
        "is_private": is_private
    }).execute()

    if not mem_resp.data:
        raise HTTPException(status_code=500, detail="Failed to create memory record")

    memory_id = mem_resp.data[0]["id"]
    media_records = []

    for f in files:
        content = await f.read()
        file_obj = io.BytesIO(content)
        mime = f.content_type or ""
        fname = f.filename or "upload"

        if mime.startswith("video/"):
            file_url = upload_to_youtube(file_obj, title=f"{title} - {fname}", description=description, mime_type=mime)
        else:
            file_url = upload_to_drive(file_obj, filename=fname, mime_type=mime)

        media_records.append({
            "memory_id": memory_id,
            "file_url": file_url,
            "file_type": "video" if mime.startswith("video/") else ("audio" if mime.startswith("audio/") else "image")
        })

    if media_records:
        supabase.table("memory_media").insert(media_records).execute()

    full_mem = supabase.table("memories").select("*, memory_media(*)").eq("id", memory_id).single().execute()
    return full_mem.data

@router.post("/memories/{memory_id}/media")
async def add_media_to_memory(memory_id: str, files: List[UploadFile] = File(...)):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not connected")

    mem = supabase.table("memories").select("title, description").eq("id", memory_id).single().execute()
    title = mem.data.get("title", "Memory") if mem.data else "Memory"
    desc = mem.data.get("description", "") if mem.data else ""

    media_records = []
    for f in files:
        content = await f.read()
        file_obj = io.BytesIO(content)
        mime = f.content_type or ""
        fname = f.filename or "upload"

        if mime.startswith("video/"):
            file_url = upload_to_youtube(file_obj, title=f"{title} - {fname}", description=desc, mime_type=mime)
        else:
            file_url = upload_to_drive(file_obj, filename=fname, mime_type=mime)

        media_records.append({
            "memory_id": memory_id,
            "file_url": file_url,
            "file_type": "video" if mime.startswith("video/") else ("audio" if mime.startswith("audio/") else "image")
        })

    if media_records:
        supabase.table("memory_media").insert(media_records).execute()

    return {"status": "success", "added": len(media_records)}

@router.put("/memories/{memory_id}")
def update_memory(memory_id: str, req: UpdateMemoryRequest):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not connected")
    update_data = req.model_dump(exclude_none=True)
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

@router.get("/memories/{memory_id}/download")
def download_album_zip(memory_id: str):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not connected")
    media_resp = supabase.table("memory_media").select("*").eq("memory_id", memory_id).execute()
    media_list = media_resp.data or []

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for idx, m in enumerate(media_list):
            url = m.get("file_url", "").replace("voice#", "").replace("video#", "")
            if "youtube.com" in url or "youtu.be" in url:
                continue
            try:
                r = requests.get(url, timeout=15)
                if r.status_code == 200:
                    ext = "webm" if m.get("file_type") == "audio" else ("mp4" if m.get("file_type") == "video" else "jpg")
                    zip_file.writestr(f"memory_{idx+1}.{ext}", r.content)
            except Exception:
                pass

    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=memory_{memory_id}.zip"}
    )

# import os
# import io
# import json
# import zipfile
# import urllib.request
# import asyncio
# import tempfile
# from typing import List
# from pydantic import BaseModel
# from fastapi import APIRouter, UploadFile, File, Form, HTTPException
# from fastapi.responses import StreamingResponse

# from backend.config import supabase
# from backend.services.google_cloud import upload_to_youtube, upload_to_drive, delete_from_cloud

# router = APIRouter(prefix="/api")

# class MemoryUpdate(BaseModel):
#     description: str

# def process_and_upload_media(memory_id, file_bytes, filename, content_type, album_title):
#     with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{filename}") as temp_file:
#         temp_file.write(file_bytes)
#         temp_path = temp_file.name

#     try:
#         file_size_mb = os.path.getsize(temp_path) / (1024 * 1024)
#         is_video = filename.lower().endswith(('.mp4', '.mov', '.webm', '.avi'))
        
#         media_data = {}
#         if is_video and file_size_mb > 100:
#             video_id = upload_to_youtube(temp_path, f"Memory {memory_id}: {album_title}", "Private Vault Video")
#             media_data = {
#                 "provider": "youtube",
#                 "id": video_id,
#                 "url": f"https://www.youtube.com/watch?v={video_id}"
#             }
#         else:
#             drive_file = upload_to_drive(temp_path, content_type, filename)
#             media_data = {
#                 "provider": "drive",
#                 "id": drive_file.get('id'),
#                 "original": drive_file.get('webContentLink'),
#                 "thumb": drive_file.get('thumbnailLink', drive_file.get('webContentLink')).replace('=s220', '=s1000')
#             }

#         json_url = json.dumps(media_data)
#         supabase.table("memory_media").insert({"memory_id": memory_id, "file_url": json_url}).execute()
#     finally:
#         if os.path.exists(temp_path):
#             os.remove(temp_path)

# @router.get("/memories")
# def get_memories(limit: int = 12, offset: int = 0):
#     if not supabase: return []
#     response = supabase.table("memories").select(
#         "id, memory_date, title, description, is_private, created_at, memory_media(id, file_url, created_at)"
#     ).order("memory_date", desc=True).range(offset, offset + limit - 1).execute()
#     return response.data

# @router.post("/memories")
# async def create_memory(
#     date: str = Form(...),
#     title: str = Form(...),
#     description: str = Form(""),
#     is_private: str = Form("false"),
#     files: List[UploadFile] = File(...)
# ):
#     try:
#         is_priv_bool = is_private.lower() == 'true'
        
#         def insert_mem():
#             return supabase.table("memories").insert({
#                 "memory_date": date, "title": title, "description": description, "is_private": is_priv_bool
#             }).execute()
            
#         mem_resp = await asyncio.to_thread(insert_mem)
#         memory_id = mem_resp.data[0]['id']

#         for file in files:
#             file_bytes = await file.read()
#             await asyncio.to_thread(process_and_upload_media, memory_id, file_bytes, file.filename, file.content_type, title)

#         return {"message": "Memory created successfully!"}
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))

# @router.put("/memories/{memory_id}")
# def update_memory(memory_id: int, req: MemoryUpdate):
#     supabase.table("memories").update({"description": req.description}).eq("id", memory_id).execute()
#     return {"message": "Memory updated."}

# @router.delete("/memories/{memory_id}")
# def delete_memory(memory_id: int):
#     media_resp = supabase.table("memory_media").select("file_url").eq("memory_id", memory_id).execute()
#     for media in media_resp.data:
#         delete_from_cloud(media['file_url'])
        
#     supabase.table("memories").delete().eq("id", memory_id).execute()
#     return {"message": "Memory deleted."}

# @router.post("/memories/{memory_id}/media")
# async def add_media_to_memory(memory_id: int, files: List[UploadFile] = File(...)):
#     try:
#         mem_resp = supabase.table("memories").select("title").eq("id", memory_id).execute()
#         title = mem_resp.data[0]['title'] if mem_resp.data else "Memory"
        
#         for file in files:
#             file_bytes = await file.read()
#             await asyncio.to_thread(process_and_upload_media, memory_id, file_bytes, file.filename, file.content_type, title)
#         return {"message": "Media added!"}
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))

# @router.delete("/media/{media_id}")
# def delete_media(media_id: int):
#     media_resp = supabase.table("memory_media").select("file_url").eq("id", media_id).execute()
#     if media_resp.data:
#         delete_from_cloud(media_resp.data[0]['file_url'])
        
#     supabase.table("memory_media").delete().eq("id", media_id).execute()
#     return {"message": "Media deleted."}

# @router.get("/media/proxy/{file_id}")
# def proxy_media(file_id: str):
#     url = f"https://drive.google.com/uc?export=download&id={file_id}"
#     req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
#     try:
#         response = urllib.request.urlopen(req)
#         def iterfile():
#             while True:
#                 chunk = response.read(8192)
#                 if not chunk: break
#                 yield chunk
#         return StreamingResponse(
#             iterfile(), 
#             media_type=response.headers.get('Content-Type', 'image/jpeg'),
#             headers={"Cache-Control": "public, max-age=31536000, immutable"}
#         )
#     except Exception:
#         raise HTTPException(status_code=404, detail="Image proxy failed")

# @router.get("/memories/{memory_id}/download")
# def download_album(memory_id: int):
#     try:
#         media_resp = supabase.table("memory_media").select("file_url").eq("memory_id", memory_id).execute()
#         zip_buffer = io.BytesIO()
#         with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False) as zip_file:
#             for idx, media in enumerate(media_resp.data):
#                 try:
#                     media_data = json.loads(media['file_url'])
#                     download_url = media_data.get('original', media_data.get('url'))
#                 except:
#                     download_url = media['file_url']
                    
#                 if not download_url: continue
                
#                 try:
#                     req = urllib.request.Request(download_url, headers={'User-Agent': 'Mozilla/5.0'})
#                     with urllib.request.urlopen(req) as response:
#                         ext = "mp4" if "youtube" in str(download_url) else "jpg"
#                         zip_file.writestr(f"memory_{memory_id}_media_{idx+1}.{ext}", response.read())
#                 except Exception:
#                     continue
                    
#         zip_buffer.seek(0)
#         return StreamingResponse(
#             zip_buffer, media_type="application/x-zip-compressed", headers={"Content-Disposition": f"attachment; filename=memory_album_{memory_id}.zip"}
#         )
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))