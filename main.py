import os
import json
import random
import io
import zipfile
import urllib.request
import asyncio
import tempfile
from datetime import datetime
from typing import List, Optional
import glob

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from supabase import create_client, Client
from groq import Groq

# Google API Imports
from google.oauth2.service_account import Credentials as ServiceAccountCredentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
import pickle

load_dotenv()
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# App Credentials
APP_USERNAME = os.getenv("APP_USERNAME", "us")
APP_PASSWORD = os.getenv("APP_PASSWORD", "forever")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None
groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

# --- GOOGLE DRIVE MULTI-ACCOUNT LOGIC ---
SCOPES_DRIVE = ['https://www.googleapis.com/auth/drive.file']
SCOPES_YOUTUBE = ['https://www.googleapis.com/auth/youtube.upload']

def get_drive_service(account_index=1):
    json_path = f"drive_account_{account_index}.json"
    if not os.path.exists(json_path):
        return None, None
    creds = ServiceAccountCredentials.from_service_account_file(json_path, scopes=SCOPES_DRIVE)
    service = build('drive', 'v3', credentials=creds, cache_discovery=False)
    folder_id = os.getenv(f"DRIVE_FOLDER_ID_{account_index}")
    return service, folder_id

def upload_to_drive(file_path, mime_type, original_filename):
    # Try accounts sequentially until one succeeds (in case storage is full)
    for i in range(1, 10):
        service, folder_id = get_drive_service(i)
        if not service:
            break # No more accounts left
            
        try:
            file_metadata = {'name': original_filename, 'parents': [folder_id]}
            media = MediaFileUpload(file_path, mimetype=mime_type, resumable=True)
            file_data = service.files().create(
                body=file_metadata, 
                media_body=media, 
                fields='id, webContentLink, thumbnailLink'
            ).execute()
            
            # Make public to viewer
            service.permissions().create(
                fileId=file_data.get('id'),
                body={'type': 'anyone', 'role': 'reader'}
            ).execute()
            
            return file_data
        except Exception as e:
            print(f"Drive {i} failed (maybe full?): {e}")
            continue
            
    raise Exception("All Google Drive accounts are full or misconfigured!")

# --- YOUTUBE MULTI-ACCOUNT LOGIC ---
def get_youtube_service(account_index=1):
    json_path = f"youtube_client_{account_index}.json"
    pickle_path = f"youtube_token_{account_index}.pickle"
    
    if not os.path.exists(json_path):
        return None

    creds = None
    if os.path.exists(pickle_path):
        with open(pickle_path, 'rb') as token:
            creds = pickle.load(token)
            
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(json_path, SCOPES_YOUTUBE)
            creds = flow.run_local_server(port=0)
        with open(pickle_path, 'wb') as token:
            pickle.dump(creds, token)
            
    return build('youtube', 'v3', credentials=creds, cache_discovery=False)

def upload_to_youtube(file_path, title, description):
    for i in range(1, 10):
        youtube = get_youtube_service(i)
        if not youtube:
            break
            
        try:
            body = {
                'snippet': {
                    'title': title,
                    'description': description,
                    'categoryId': '22' # People & Blogs
                },
                'status': {
                    'privacyStatus': 'unlisted' # Private but accessible via exact link
                }
            }
            media = MediaFileUpload(file_path, chunksize=-1, resumable=True)
            request = youtube.videos().insert(part=','.join(body.keys()), body=body, media_body=media)
            response = request.execute()
            return response.get('id')
        except Exception as e:
            print(f"YouTube account {i} failed (maybe quota hit?): {e}")
            continue
            
    raise Exception("All YouTube accounts reached quota or are misconfigured!")

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                pass

manager = ConnectionManager()

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

@app.websocket("/ws/chat")
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

class LoginRequest(BaseModel):
    username: str
    password: str

@app.post("/api/login")
def login(req: LoginRequest):
    if req.username == APP_USERNAME and req.password == APP_PASSWORD:
        return {"success": True}
    raise HTTPException(status_code=401, detail="Invalid credentials.")

@app.get("/api/chats")
def get_chats():
    if not supabase: return []
    resp = supabase.table("chat_messages").select("*").order("created_at", desc=False).execute()
    return resp.data

@app.get("/api/itineraries")
def get_itineraries():
    if not supabase: return []
    resp = supabase.table("itineraries").select("*").order("updated_at", desc=True).execute()
    return resp.data

class ItineraryCreate(BaseModel):
    title: str

@app.post("/api/itineraries")
def create_itinerary(req: ItineraryCreate):
    resp = supabase.table("itineraries").insert({"title": req.title, "content": ""}).execute()
    return resp.data[0]

class ItineraryUpdate(BaseModel):
    content: Optional[str] = None
    title: Optional[str] = None

@app.put("/api/itineraries/{doc_id}")
def update_itinerary(doc_id: int, req: ItineraryUpdate):
    update_data = {"updated_at": datetime.now().isoformat()}
    if req.content is not None: update_data["content"] = req.content
    if req.title is not None: update_data["title"] = req.title
    supabase.table("itineraries").update(update_data).eq("id", doc_id).execute()
    return {"success": True}

@app.delete("/api/itineraries/{doc_id}")
def delete_itinerary(doc_id: int):
    supabase.table("itineraries").delete().eq("id", doc_id).execute()
    return {"success": True}

@app.get("/api/memories")
def get_memories(limit: int = 12, offset: int = 0):
    if not supabase: return []
    response = supabase.table("memories").select(
        "id, memory_date, title, description, is_private, created_at, memory_media(id, file_url, created_at)"
    ).order("memory_date", desc=True).range(offset, offset + limit - 1).execute()
    return response.data

# THREAD-SAFE UPLOAD LOGIC
def process_and_upload_media(memory_id, file_bytes, filename, content_type, album_title):
    # 1. Save to temporary disk (Prevents server memory crashes on 500MB+ videos)
    with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{filename}") as temp_file:
        temp_file.write(file_bytes)
        temp_path = temp_file.name

    try:
        file_size_mb = os.path.getsize(temp_path) / (1024 * 1024)
        is_video = filename.lower().endswith(('.mp4', '.mov', '.webm', '.avi'))
        
        media_data = {}
        
        if is_video and file_size_mb > 100:
            # Route to YouTube
            video_id = upload_to_youtube(temp_path, f"Memory {memory_id}: {album_title}", "Private Vault Video")
            media_data = {
                "provider": "youtube",
                "id": video_id,
                "url": f"https://www.youtube.com/watch?v={video_id}"
            }
        else:
            # Route to Google Drive (Photos, Audio, Small Videos)
            drive_file = upload_to_drive(temp_path, content_type, filename)
            media_data = {
                "provider": "drive",
                "id": drive_file.get('id'),
                "original": drive_file.get('webContentLink'),
                "thumb": drive_file.get('thumbnailLink', drive_file.get('webContentLink')).replace('=s220', '=s1000') # Request high-res WebP
            }

        # Save smart JSON string to Supabase DB (No SQL migrations needed!)
        json_url = json.dumps(media_data)
        supabase.table("memory_media").insert({"memory_id": memory_id, "file_url": json_url}).execute()
        
    finally:
        # 3. Clean up temp file
        os.remove(temp_path)

@app.post("/api/memories")
async def create_memory(
    date: str = Form(...),
    title: str = Form(...),
    description: str = Form(""),
    is_private: str = Form("false"),
    files: List[UploadFile] = File(...)
):
    try:
        is_priv_bool = is_private.lower() == 'true'
        
        def insert_mem():
            return supabase.table("memories").insert({
                "memory_date": date, "title": title, "description": description, "is_private": is_priv_bool
            }).execute()
            
        mem_resp = await asyncio.to_thread(insert_mem)
        memory_id = mem_resp.data[0]['id']

        # Process all files asynchronously so server isn't blocked
        for file in files:
            file_bytes = await file.read()
            await asyncio.to_thread(process_and_upload_media, memory_id, file_bytes, file.filename, file.content_type, title)

        return {"message": "Memory created successfully!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class MemoryUpdate(BaseModel):
    description: str

@app.put("/api/memories/{memory_id}")
def update_memory(memory_id: int, req: MemoryUpdate):
    supabase.table("memories").update({"description": req.description}).eq("id", memory_id).execute()
    return {"message": "Memory updated."}

@app.delete("/api/memories/{memory_id}")
def delete_memory(memory_id: int):
    supabase.table("memories").delete().eq("id", memory_id).execute()
    return {"message": "Memory deleted."}

@app.post("/api/memories/{memory_id}/media")
async def add_media_to_memory(memory_id: int, files: List[UploadFile] = File(...)):
    try:
        mem_resp = supabase.table("memories").select("title").eq("id", memory_id).execute()
        title = mem_resp.data[0]['title'] if mem_resp.data else "Memory"
        
        for file in files:
            file_bytes = await file.read()
            await asyncio.to_thread(process_and_upload_media, memory_id, file_bytes, file.filename, file.content_type, title)
        return {"message": "Media added!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/media/{media_id}")
def delete_media(media_id: int):
    supabase.table("memory_media").delete().eq("id", media_id).execute()
    return {"message": "Media deleted."}

@app.get("/api/memories/{memory_id}/download")
def download_album(memory_id: int):
    try:
        media_resp = supabase.table("memory_media").select("file_url").eq("memory_id", memory_id).execute()
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False) as zip_file:
            for idx, media in enumerate(media_resp.data):
                try:
                    # Parse our smart JSON
                    media_data = json.loads(media['file_url'])
                    download_url = media_data.get('original', media_data.get('url'))
                except:
                    # Fallback for old Supabase URLs
                    download_url = media['file_url']
                    
                if not download_url: continue
                
                try:
                    req = urllib.request.Request(download_url, headers={'User-Agent': 'Mozilla/5.0'})
                    with urllib.request.urlopen(req) as response:
                        ext = "mp4" if "youtube" in str(download_url) else "jpg"
                        zip_file.writestr(f"memory_{memory_id}_media_{idx+1}.{ext}", response.read())
                except Exception:
                    continue
                    
        zip_buffer.seek(0)
        return StreamingResponse(
            zip_buffer, media_type="application/x-zip-compressed", headers={"Content-Disposition": f"attachment; filename=memory_album_{memory_id}.zip"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/chronicle")
def get_daily_chronicle():
    if not supabase or not groq_client: return {"memory": None, "article": "Configure APIs first."}
    resp = supabase.table("memories").select("id, title, description, memory_date, memory_media(file_url)").eq("is_private", False).execute()
    if not resp.data: return {"memory": None, "article": "Vault is empty."}
        
    random.seed(datetime.now().date().toordinal())
    selected = random.choice(resp.data)
    
    prompt = f"Act as a romantic journalist for a couple's newspaper. Write a 4-paragraph front-page story about this date: {selected['title']} on {selected['memory_date']}. Notes: {selected['description']}"
    
    completion = groq_client.chat.completions.create(
        messages=[{"role": "user", "content": prompt}],
        model="openai/gpt-oss-120b", temperature=0.7
    )
    return {"memory": selected, "article": completion.choices[0].message.content}

class PookieMessage(BaseModel):
    message: str
    history: List[dict]

@app.post("/api/pookie/chat")
def pookie_chat(req: PookieMessage):
    resp = supabase.table("memories").select("title, description, memory_date").eq("is_private", False).execute()
    ctx = "Vault Context:\n" + "\n".join([f"- {m['memory_date']}: {m['title']} ({m['description']})" for m in resp.data])
    
    messages = [{"role": "system", "content": f"You are Pookie, an affectionate AI date planner. {ctx}"}]
    for msg in req.history:
        messages.append({"role": "user" if msg["sender"] == "user" else "assistant", "content": msg["text"]})
    messages.append({"role": "user", "content": req.message})

    completion = groq_client.chat.completions.create(messages=messages, model="openai/gpt-oss-120b", temperature=0.7, max_tokens=800)
    return {"reply": completion.choices[0].message.content}