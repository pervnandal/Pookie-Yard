import os
import random
import requests
from datetime import datetime
from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from groq import Groq
from backend.config import supabase

router = APIRouter(prefix="/api")

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY")) if os.getenv("GROQ_API_KEY") else None

PRIMARY_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
FAST_MODEL = "llama-3.1-8b-instant"

# Configure Special Occasions (MM-DD format)
SPECIAL_OCCASIONS = {
    "05-04": {"title": "Our Anniversary 💖", "type": "anniversary", "desc": "Celebrating the day our story began!"},
    "02-14": {"title": "Valentine's Day 🌹", "type": "romance", "desc": "A day dedicated to our love."},
    "01-01": {"title": "New Year's Day ✨", "type": "celebration", "desc": "Starting another beautiful year together."}
}

def call_groq(messages: List[Dict[str, str]], model: str = PRIMARY_MODEL, temperature: float = 0.7, max_tokens: int = 800) -> str:
    if not groq_client:
        return "Pookie is resting right now (GROQ_API_KEY is missing in environment)."
    try:
        completion = groq_client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens
        )
        return completion.choices[0].message.content.strip()
    except Exception as e:
        print(f"Primary Groq model ({model}) error: {e}. Attempting fallback...")
        fallback_model = "meta-llama/llama-4-scout-17b-16e-instruct" if model == PRIMARY_MODEL else PRIMARY_MODEL
        completion = groq_client.chat.completions.create(
            model=fallback_model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens
        )
        return completion.choices[0].message.content.strip()

def get_today_occasion():
    now = datetime.now()
    mm_dd = now.strftime("%m-%d")
    if mm_dd in SPECIAL_OCCASIONS:
        return SPECIAL_OCCASIONS[mm_dd]
    if now.day == 4:
        return {
            "title": "Happy Monthiversary! 💕",
            "type": "monthiversary",
            "desc": "Another month of building memories together."
        }
    return None

def fetch_weather_and_map_context(place_query: Optional[str] = None, lat: Optional[float] = None, lon: Optional[float] = None) -> str:
    """Task 6: Fetches real-time OpenStreetMap geocoding, Overpass surrounding POIs, and Open-Meteo live weather."""
    headers = {"User-Agent": "TheUsSpaceApp/2.0"}
    location_name = "User's Current Location"

    try:
        # 1. Geocode place name if user asked about a specific location/city/spot
        if place_query:
            geo_res = requests.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": place_query, "format": "json", "addressdetails": 1, "limit": 1},
                headers=headers,
                timeout=6
            ).json()
            if geo_res:
                lat = float(geo_res[0]["lat"])
                lon = float(geo_res[0]["lon"])
                location_name = geo_res[0].get("display_name", place_query)

        if lat is None or lon is None:
            return ""

        # Reverse geocode if we only have raw GPS coordinates
        if not place_query:
            try:
                rev_res = requests.get(
                    "https://nominatim.openstreetmap.org/reverse",
                    params={"lat": lat, "lon": lon, "format": "json"},
                    headers=headers,
                    timeout=5
                ).json()
                if rev_res and "display_name" in rev_res:
                    location_name = rev_res["display_name"]
            except Exception:
                pass

        context_parts = [f"📍 Target Location: {location_name} (Coordinates: {lat:.4f}, {lon:.4f})"]

        # 2. Fetch Live Weather & Forecast via Open-Meteo
        weather_res = requests.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude": lat,
                "longitude": lon,
                "current_weather": "true",
                "daily": "temperature_2m_max,temperature_2m_min,precipitation_probability_max",
                "timezone": "auto"
            },
            timeout=6
        ).json()

        if "current_weather" in weather_res:
            cw = weather_res["current_weather"]
            daily = weather_res.get("daily", {})
            max_t = daily.get("temperature_2m_max", ["--"])[0]
            min_t = daily.get("temperature_2m_min", ["--"])[0]
            rain_prob = daily.get("precipitation_probability_max", [0])[0]
            context_parts.append(
                f"🌤️ Live Weather: {cw.get('temperature')}°C, Wind: {cw.get('windspeed')} km/h. "
                f"Today's High: {max_t}°C, Low: {min_t}°C, Rain Probability: {rain_prob}%."
            )

        # 3. Fetch Surrounding Area POIs (Cafes, Restaurants, Parks, Attractions, Viewpoints) within 3.5km via Overpass API
        overpass_query = f"""
        [out:json][timeout:6];
        (
          node["amenity"~"cafe|restaurant|cinema|theatre|ice_cream"](around:3500,{lat},{lon});
          node["tourism"~"attraction|viewpoint|museum|gallery"](around:4500,{lat},{lon});
          node["leisure"~"park|garden|nature_reserve"](around:3500,{lat},{lon});
        );
        out body 25;
        """
        ov_res = requests.post(
            "https://overpass-api.de/api/interpreter",
            data={"data": overpass_query},
            headers=headers,
            timeout=7
        ).json()

        elements = ov_res.get("elements", [])
        nearby_places = []
        for el in elements:
            tags = el.get("tags", {})
            name = tags.get("name")
            kind = tags.get("amenity") or tags.get("tourism") or tags.get("leisure")
            if name and kind:
                nearby_places.append(f"{name} ({kind.replace('_', ' ')})")

        if nearby_places:
            unique_places = list(dict.fromkeys(nearby_places))[:15]
            context_parts.append(f"🗺️ Surrounding Area & Nearby Spots (within 3.5km): {', '.join(unique_places)}.")

        return "\n".join(context_parts)
    except Exception as e:
        print(f"Map/Weather context warning: {e}")
        return ""

class PookieRequest(BaseModel):
    message: str
    lat: Optional[float] = None
    lon: Optional[float] = None
    history: Optional[List[Dict[str, Any]]] = []

@router.post("/pookie")
def ask_pookie(req: PookieRequest):
    memories = []
    if supabase:
        resp = supabase.table("memories").select("id, title, description, memory_date").order("memory_date", desc=True).limit(30).execute()
        memories = resp.data or []

    # Step 1: Extract location/place name if user is asking about somewhere specific
    place_extracted = None
    try:
        ext_messages = [
            {
                "role": "system",
                "content": "Extract ONLY the geographical place, city, neighborhood, or landmark mentioned in the user's message. If no specific place is mentioned, reply with EXACTLY 'NONE'."
            },
            {"role": "user", "content": req.message}
        ]
        ext_res = call_groq(ext_messages, model=FAST_MODEL, temperature=0.0, max_tokens=30)
        if ext_res and ext_res.upper() != "NONE" and len(ext_res) < 60:
            place_extracted = ext_res.strip("\"'.,!")
    except Exception:
        pass

    # Step 2: Fetch live weather, map coordinates, and surrounding places
    map_weather_info = fetch_weather_and_map_context(place_query=place_extracted, lat=req.lat, lon=req.lon)
    occasion = get_today_occasion()

    system_prompt = f"""You are 'Pookie', the affectionate, witty, and hyper-intelligent relationship, memory, and travel AI companion for 'The Us Space'.
Today's Date: {datetime.now().strftime('%B %d, %Y')}.
{f"🎉 SPECIAL OCCASION TODAY: {occasion['title']} - {occasion['desc']}" if occasion else ""}

REAL-TIME MAP, SURROUNDING AREA & WEATHER INTELLIGENCE:
{map_weather_info if map_weather_info else "No live GPS coordinates provided for this query; rely on your comprehensive geographical knowledge of streets, landmarks, cafes, and surrounding areas."}

COUPLE'S SAVED MEMORIES IN VAULT:
{memories}

INSTRUCTIONS:
1. If the user asks about the weather, a place, or date ideas, combine the REAL-TIME MAP & WEATHER data above with your deep geographic knowledge of the area, surrounding neighborhoods, vibe, and best spots.
2. If the user asks about a past memory, reference the exact title and date from COUPLE'S SAVED MEMORIES.
3. Keep responses warm, conversational, and concise."""

    groq_messages = [{"role": "system", "content": system_prompt}]
    for h in (req.history or [])[-6:]:
        role = "assistant" if h.get("sender") == "pookie" or h.get("role") == "assistant" else "user"
        content = h.get("text") or h.get("content") or ""
        if content:
            groq_messages.append({"role": role, "content": content})

    groq_messages.append({"role": "user", "content": req.message})

    reply_text = call_groq(groq_messages, model=PRIMARY_MODEL, temperature=0.7, max_tokens=600)

    # Check if Pookie referenced a specific memory so the frontend can offer a direct "Open Album" button
    matched_memory_id = None
    for m in memories:
        if m.get("title") and m["title"].lower() in reply_text.lower():
            matched_memory_id = m["id"]
            break

    return {
        "reply": reply_text,
        "memory_id": matched_memory_id
    }

@router.get("/chronicle")
def generate_chronicle(occasion_override: Optional[str] = Query(None)):
    if not supabase:
        return {"article": "Database offline.", "memory": None, "occasion": None}

    resp = supabase.table("memories").select("*, memory_media(*)").order("memory_date", desc=True).execute()
    all_memories = resp.data or []
    if not all_memories:
        return {"article": "Add your first memory to print the Chronicle!", "memory": None, "occasion": None}

    now = datetime.now()
    today_mm_dd = now.strftime("%m-%d")
    occasion = get_today_occasion()

    # Task 7: Prioritize any album captured on today's month & day
    matching_day_memories = [
        m for m in all_memories
        if m.get("memory_date", "")[5:10] == today_mm_dd
    ]

    if matching_day_memories:
        chosen_memory = matching_day_memories[0]
        if not occasion:
            occasion = {
                "title": "On This Day in Our History ✨",
                "type": "memory_anniversary",
                "desc": f"Looking back at '{chosen_memory.get('title')}'!"
            }
    else:
        chosen_memory = random.choice(all_memories)

    prompt = f"""Write a romantic, engaging vintage newspaper front-page article (2 to 3 paragraphs) for 'The Daily Chronicle'.
Do NOT include a headline at the top (the UI renders the headline separately). Use markdown **bold** and *italics* naturally for emphasis.
Memory Title: {chosen_memory.get('title')}
Memory Date: {chosen_memory.get('memory_date')}
Memory Story: {chosen_memory.get('description')}
{f"SPECIAL CELEBRATION TODAY: Today is '{occasion['title']}' ({occasion['desc']}). Celebratory special edition! Weave today's special celebration and memories from this day joyously into the article!" if occasion else ""}"""

    try:
        article = call_groq(
            [
                {"role": "system", "content": "You are the chief romantic journalist for 'The Daily Chronicle', a couple's private vintage newspaper."},
                {"role": "user", "content": prompt}
            ],
            model=PRIMARY_MODEL,
            temperature=0.75,
            max_tokens=700
        )
    except Exception:
        article = chosen_memory.get("description") or "A timeless moment captured in our vault."

    return {
        "memory": chosen_memory,
        "article": article,
        "occasion": occasion
    }
# import random
# from datetime import datetime
# from typing import List
# from fastapi import APIRouter
# from pydantic import BaseModel
# from backend.config import supabase, groq_client

# router = APIRouter(prefix="/api")

# class PookieMessage(BaseModel):
#     message: str
#     history: List[dict]

# @router.get("/chronicle")
# def get_daily_chronicle():
#     if not supabase or not groq_client: 
#         return {"memory": None, "article": "Configure APIs first."}
        
#     resp = supabase.table("memories").select("id, title, description, memory_date, memory_media(file_url)").eq("is_private", False).execute()
#     if not resp.data: 
#         return {"memory": None, "article": "Vault is empty."}
        
#     random.seed(datetime.now().date().toordinal())
#     selected = random.choice(resp.data)
    
#     prompt = f"Act as a romantic journalist for a couple's newspaper. Write a 4-paragraph front-page story about this date: {selected['title']} on {selected['memory_date']}. Notes: {selected['description']}"
    
#     completion = groq_client.chat.completions.create(
#         messages=[{"role": "user", "content": prompt}],
#         model="openai/gpt-oss-120b", temperature=0.7
#     )
#     return {"memory": selected, "article": completion.choices[0].message.content}

# @router.post("/pookie/chat")
# def pookie_chat(req: PookieMessage):
#     resp = supabase.table("memories").select("title, description, memory_date").eq("is_private", False).execute()
#     ctx = "Vault Context:\n" + "\n".join([f"- {m['memory_date']}: {m['title']} ({m['description']})" for m in resp.data])
    
#     messages = [{"role": "system", "content": f"You are Pookie, an affectionate AI date planner. {ctx}"}]
#     for msg in req.history:
#         messages.append({"role": "user" if msg["sender"] == "user" else "assistant", "content": msg["text"]})
#     messages.append({"role": "user", "content": req.message})

#     completion = groq_client.chat.completions.create(
#         messages=messages, 
#         model="openai/gpt-oss-120b", 
#         temperature=0.7, 
#         max_tokens=800
#     )
#     return {"reply": completion.choices[0].message.content}