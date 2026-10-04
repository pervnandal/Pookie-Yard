import os
import json
import random
import io
import zipfile
import urllib.request
from datetime import datetime
from typing import List, Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from supabase import create_client, Client
from groq import Groq

# Load environment variables
load_dotenv()

# Initialize FastAPI
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Authentication Credentials
APP_USERNAME = os.getenv("APP_USERNAME", "us")
APP_PASSWORD = os.getenv("APP_PASSWORD", "forever")

class LoginRequest(BaseModel):
    username: str
    password: str

@app.post("/api/login")
async def login(req: LoginRequest):
    if req.username == APP_USERNAME and req.password == APP_PASSWORD:
        return {"success": True}
    raise HTTPException(status_code=401, detail="Invalid credentials. Nice try!")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if SUPABASE_URL and SUPABASE_KEY:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
else:
    supabase = None
    print("WARNING: Supabase credentials not found in .env")

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if GROQ_API_KEY:
    groq_client = Groq(api_key=GROQ_API_KEY)
else:
    groq_client = None
    print("WARNING: Groq API key not found in .env")

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
            except Exception as e:
                print(f"Error sending message to a client: {e}")

manager = ConnectionManager()

@app.websocket("/ws/chat")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await manager.broadcast(data)
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.get("/api/memories")
async def get_memories():
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not connected.")
    try:
        response = supabase.table("memories").select(
            "id, memory_date, title, description, is_private, created_at, memory_media(id, file_url, created_at)"
        ).order("memory_date", desc=True).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/memories")
async def create_memory(
    date: str = Form(...),
    title: str = Form(...),
    description: str = Form(""),
    is_private: str = Form("false"),
    files: List[UploadFile] = File(...)
):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not connected.")
    try:
        # Convert string to boolean
        is_priv_bool = is_private.lower() == 'true'

        mem_resp = supabase.table("memories").insert({
            "memory_date": date,
            "title": title,
            "description": description,
            "is_private": is_priv_bool
        }).execute()
        
        memory_id = mem_resp.data[0]['id']

        for file in files:
            file_ext = file.filename.split(".")[-1]
            file_name = f"memory_{memory_id}_{datetime.now().timestamp()}.{file_ext}"
            file_bytes = await file.read()
            
            supabase.storage.from_("memory_images").upload(
                file_name,
                file_bytes,
                {"content-type": file.content_type}
            )
            
            file_url = supabase.storage.from_("memory_images").get_public_url(file_name)
            
            supabase.table("memory_media").insert({
                "memory_id": memory_id,
                "file_url": file_url
            }).execute()

        return {"message": "Memory created successfully!", "memory_id": memory_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class MemoryUpdate(BaseModel):
    description: str

@app.put("/api/memories/{memory_id}")
async def update_memory(memory_id: int, memory_update: MemoryUpdate):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not connected.")
    try:
        supabase.table("memories").update({"description": memory_update.description}).eq("id", memory_id).execute()
        return {"message": "Memory updated."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/memories/{memory_id}")
async def delete_memory(memory_id: int):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not connected.")
    try:
        supabase.table("memories").delete().eq("id", memory_id).execute()
        return {"message": "Memory deleted."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/memories/{memory_id}/media")
async def add_media_to_memory(memory_id: int, files: List[UploadFile] = File(...)):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not connected.")
    try:
        for file in files:
            file_ext = file.filename.split(".")[-1]
            file_name = f"memory_{memory_id}_{datetime.now().timestamp()}.{file_ext}"
            file_bytes = await file.read()
            
            supabase.storage.from_("memory_images").upload(
                file_name,
                file_bytes,
                {"content-type": file.content_type}
            )
            
            file_url = supabase.storage.from_("memory_images").get_public_url(file_name)
            
            supabase.table("memory_media").insert({
                "memory_id": memory_id,
                "file_url": file_url
            }).execute()

        return {"message": "Media added successfully!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/media/{media_id}")
async def delete_media(media_id: int):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not connected.")
    try:
        supabase.table("memory_media").delete().eq("id", media_id).execute()
        return {"message": "Media deleted."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/memories/{memory_id}/download")
async def download_album(memory_id: int):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not connected")
    try:
        media_resp = supabase.table("memory_media").select("file_url").eq("memory_id", memory_id).execute()
        if not media_resp.data:
            raise HTTPException(status_code=404, detail="No media found")
            
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False) as zip_file:
            for idx, media in enumerate(media_resp.data):
                url = media['file_url']
                try:
                    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                    with urllib.request.urlopen(req) as response:
                        file_ext = url.split("?")[0].split(".")[-1]
                        zip_file.writestr(f"memory_{memory_id}_photo_{idx+1}.{file_ext}", response.read())
                except Exception as ex:
                    print(f"Error downloading {url}: {ex}")
                    continue
                    
        zip_buffer.seek(0)
        return StreamingResponse(
            zip_buffer, 
            media_type="application/x-zip-compressed",
            headers={"Content-Disposition": f"attachment; filename=memory_album_{memory_id}.zip"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/chronicle")
async def get_daily_chronicle():
    if not supabase or not groq_client:
        raise HTTPException(status_code=500, detail="Services not configured.")
        
    try:
        # Fetch ONLY public memories
        resp = supabase.table("memories").select(
            "id, title, description, memory_date, memory_media(file_url)"
        ).eq("is_private", False).execute()
        
        memories = resp.data
        if not memories:
            return {"memory": None, "article": "Your vault is empty (or everything is private)! Add a public memory to print the newspaper."}
            
        today_seed = datetime.now().date().toordinal()
        random.seed(today_seed)
        selected_memory = random.choice(memories)
        
        prompt = f"""
        Act as a witty, romantic, and engaging journalist for 'The Daily Chronicle' - a newspaper dedicated exclusively to a couple's relationship.
        Write a fun, vivid, and beautifully structured front-page newspaper article about this specific date they went on.
        
        Memory Title: {selected_memory['title']}
        Date: {selected_memory['memory_date']}
        Description/Notes: {selected_memory['description']}
        
        Write exactly 4 distinct paragraphs. Do NOT include tiny headings or titles inside the text. Just write the 4 paragraphs of the story. 
        Make it sound like an epic romance or a fun adventure column!
        """
        
        completion = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are a Pulitzer-prize winning romance journalist."},
                {"role": "user", "content": prompt}
            ],
            model="openai/gpt-oss-120b",
            temperature=0.7,
        )
        
        article_text = completion.choices[0].message.content
        
        return {
            "memory": selected_memory,
            "article": article_text
        }
        
    except Exception as e:
        print("Chronicle Error:", e)
        raise HTTPException(status_code=500, detail=str(e))

class PookieMessage(BaseModel):
    message: str
    history: List[dict]

@app.post("/api/pookie/chat")
async def pookie_chat(req: PookieMessage):
    if not supabase or not groq_client:
        raise HTTPException(status_code=500, detail="Services not configured.")
        
    try:
        # Fetch ONLY public memories for context
        resp = supabase.table("memories").select(
            "title, description, memory_date, memory_media(file_url)"
        ).eq("is_private", False).execute()
        
        memories = resp.data
        context_text = "Here is the couple's relationship memory vault:\n\n"
        
        for m in memories:
            urls = [media['file_url'] for media in m.get('memory_media', [])]
            url_str = ", ".join(urls) if urls else "No photos"
            context_text += f"- Date: {m['memory_date']} | Title: {m['title']} | Story: {m['description']} | Photo URLs: [{url_str}]\n"
            
        system_prompt = f"""
        You are 'Pookie', an extremely smart, witty, and deeply affectionate AI concierge and elite date planner for this specific couple. 
        
        Your Capabilities:
        1. You know their public relationship history based on the Vault Context below. (Private memories are hidden from you).
        2. You can suggest incredibly personalized date ideas, build itineraries, and recommend cafes/places.
        3. IF THEY ASK TO SEE A PHOTO of a past memory, you MUST find the exact photo URL from the Vault Context and include it in your reply as a raw text link (e.g., https://...).
        
        Vault Context:
        {context_text}
        
        Respond naturally, be helpful, use emojis, and act as their biggest cheerleader!
        """
        
        messages = [{"role": "system", "content": system_prompt}]
        for msg in req.history:
            role = "user" if msg["sender"] == "user" else "assistant"
            messages.append({"role": role, "content": msg["text"]})
            
        messages.append({"role": "user", "content": req.message})

        completion = groq_client.chat.completions.create(
            messages=messages,
            model="openai/gpt-oss-120b",
            temperature=0.7,
            max_tokens=800
        )
        
        reply_text = completion.choices[0].message.content
        return {"reply": reply_text}
        
    except Exception as e:
        print("Pookie Error:", e)
        raise HTTPException(status_code=500, detail=str(e)) 