import random
from datetime import datetime
from typing import List
from fastapi import APIRouter
from pydantic import BaseModel
from backend.config import supabase, groq_client

router = APIRouter(prefix="/api")

class PookieMessage(BaseModel):
    message: str
    history: List[dict]

@router.get("/chronicle")
def get_daily_chronicle():
    if not supabase or not groq_client: 
        return {"memory": None, "article": "Configure APIs first."}
        
    resp = supabase.table("memories").select("id, title, description, memory_date, memory_media(file_url)").eq("is_private", False).execute()
    if not resp.data: 
        return {"memory": None, "article": "Vault is empty."}
        
    random.seed(datetime.now().date().toordinal())
    selected = random.choice(resp.data)
    
    prompt = f"Act as a romantic journalist for a couple's newspaper. Write a 4-paragraph front-page story about this date: {selected['title']} on {selected['memory_date']}. Notes: {selected['description']}"
    
    completion = groq_client.chat.completions.create(
        messages=[{"role": "user", "content": prompt}],
        model="openai/gpt-oss-120b", temperature=0.7
    )
    return {"memory": selected, "article": completion.choices[0].message.content}

@router.post("/pookie/chat")
def pookie_chat(req: PookieMessage):
    resp = supabase.table("memories").select("title, description, memory_date").eq("is_private", False).execute()
    ctx = "Vault Context:\n" + "\n".join([f"- {m['memory_date']}: {m['title']} ({m['description']})" for m in resp.data])
    
    messages = [{"role": "system", "content": f"You are Pookie, an affectionate AI date planner. {ctx}"}]
    for msg in req.history:
        messages.append({"role": "user" if msg["sender"] == "user" else "assistant", "content": msg["text"]})
    messages.append({"role": "user", "content": req.message})

    completion = groq_client.chat.completions.create(
        messages=messages, 
        model="openai/gpt-oss-120b", 
        temperature=0.7, 
        max_tokens=800
    )
    return {"reply": completion.choices[0].message.content}