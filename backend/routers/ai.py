import os
import re
import json
import random
import hashlib
import requests
from datetime import datetime
from dotenv import load_dotenv
from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from groq import Groq

load_dotenv()

try:
    from backend.config import supabase
except ImportError:
    try:
        from config import supabase
    except ImportError:
        from supabase import create_client
        supabase = create_client(os.getenv("SUPABASE_URL", ""), os.getenv("SUPABASE_KEY", ""))

router = APIRouter(prefix="/api")

PREFERRED_GROQ_MODELS = [
    "openai/gpt-oss-120b",
    "llama-3.3-70b-versatile",
    "meta-llama/llama-4-maverick-17b-128e-instruct",
    "meta-llama/llama-4-scout-17b-16e-instruct",
    "openai/gpt-oss-20b",
    "moonshotai/kimi-k2-instruct",
    "qwen/qwen3-32b"
]

NON_CHAT_KEYWORDS = ("whisper", "guard", "safeguard", "tts", "orpheus", "playai", "embed", "allam")

_cached_available_models: List[str] = []
_geo_cache: Dict[str, str] = {}
_vibe_cache: Dict[str, Dict[str, str]] = {}

META_REGEX = re.compile(r"\n?<!--US_META:([\s\S]*?)-->$")


def extract_clean_story_and_povs(raw_description: Optional[str]) -> Dict[str, str]:
    """
    Strips the hidden <!--US_META:...--> block and extracts Shared Story,
    His POV, and Her POV so Pookie and the Daily Chronicle read clean text.
    """
    raw = String_val = str(raw_description or "")
    match = META_REGEX.search(String_val)
    clean_shared = String_val
    his_pov = ""
    her_pov = ""

    if match:
        clean_shared = String_val[:match.start()].strip()
        try:
            meta_json = json.loads(match.group(1))
            his_pov = str(meta_json.get("hisPov") or "").strip()
            her_pov = str(meta_json.get("herPov") or "").strip()
        except Exception:
            pass

    combined_parts = []
    if clean_shared:
        combined_parts.append(f"Shared Story: {clean_shared}")
    if his_pov:
        combined_parts.append(f"His POV: {his_pov}")
    if her_pov:
        combined_parts.append(f"Her POV: {her_pov}")

    return {
        "shared": clean_shared,
        "his_pov": his_pov,
        "her_pov": her_pov,
        "combined": "\n".join(combined_parts) if combined_parts else "No description provided."
    }


def get_groq_client() -> Optional[Groq]:
    api_key = os.getenv("GROQ_API_KEY", "").strip("'\" ")
    return Groq(api_key=api_key) if api_key else None


def get_accessible_chat_models(client: Groq) -> List[str]:
    global _cached_available_models
    if _cached_available_models:
        return _cached_available_models

    try:
        model_list = client.models.list()
        live_ids = [
            m.id for m in (model_list.data or [])
            if m.id and not any(k in m.id.lower() for k in NON_CHAT_KEYWORDS)
        ]
        ordered = [m for m in PREFERRED_GROQ_MODELS if m in live_ids]
        for m in live_ids:
            if m not in ordered:
                ordered.append(m)

        if ordered:
            _cached_available_models = ordered
            return _cached_available_models
    except Exception as e:
        print(f"Groq model list discovery note: {e}")

    return PREFERRED_GROQ_MODELS


def call_groq(messages: List[Dict[str, str]], prefer_fast: bool = False, temperature: float = 0.7, max_tokens: int = 900) -> str:
    client = get_groq_client()
    if not client:
        return "GROQ_API_KEY is missing in .env!"

    candidates = list(get_accessible_chat_models(client))
    if prefer_fast and len(candidates) > 1:
        fast_first = [m for m in candidates if any(k in m for k in ("20b", "8b", "scout"))]
        others = [m for m in candidates if m not in fast_first]
        candidates = fast_first + others

    last_err = None
    for model_id in candidates:
        try:
            completion = client.chat.completions.create(
                model=model_id,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens
            )
            return completion.choices[0].message.content.strip()
        except Exception as e:
            last_err = e
            continue

    raise RuntimeError(f"All Groq models failed: {last_err}")


def select_best_memory_for_occasion(all_memories: List[dict], occasion_title: str, occasion_date: str, occasion_notes: str = "") -> dict:
    if not all_memories:
        return {}

    catalog = []
    for m in all_memories:
        parsed_story = extract_clean_story_and_povs(m.get("description"))
        catalog.append({
            "id": str(m.get("id")),
            "title": m.get("title", ""),
            "date": m.get("memory_date", ""),
            "story": parsed_story["combined"][:280]
        })

    match_prompt = f"""You are selecting the single most relevant memory album for a couple's Special Occasion.
Special Occasion Title: "{occasion_title}"
Occasion Target Date (MM-DD or YYYY-MM-DD): "{occasion_date}"
Additional Context/Keywords: "{occasion_notes}"

Available Memory Albums:
{json.dumps(catalog, ensure_ascii=False)}

SELECTION RULES:
1. Check BOTH the semantic meaning of each album's `title` and `story` AND its `date` (matching month-day MM-DD).
2. If there are multiple albums on the same date, pick the one whose title/story semantically matches "{occasion_title}".
3. If an album was celebrated on a slightly different date but its title/story clearly describes "{occasion_title}", prefer that semantically matching album!
4. Reply with ONLY the exact `id` of the best matching album, nothing else."""

    try:
        chosen_id = call_groq(
            [
                {"role": "system", "content": "Output ONLY the matching album ID string."},
                {"role": "user", "content": match_prompt}
            ],
            prefer_fast=True,
            temperature=0.0,
            max_tokens=40
        ).strip("\"'` \n")

        for m in all_memories:
            if str(m.get("id")) == chosen_id or chosen_id in str(m.get("id")):
                return m
    except Exception as e:
        print(f"Semantic album selection fallback: {e}")

    occ_words = set(re.findall(r"\w+", f"{occasion_title} {occasion_notes}".lower()))
    target_mmdd = occasion_date[-5:] if len(occasion_date) >= 5 else ""

    def score_album(m):
        score = 0
        story_info = extract_clean_story_and_povs(m.get("description"))
        text = f"{m.get('title', '')} {story_info['combined']}".lower()
        for w in occ_words:
            if len(w) > 2 and w in text:
                score += 5
        m_date = m.get("memory_date", "")
        if len(m_date) >= 10 and m_date[5:10] == target_mmdd:
            score += 4
        return score

    ranked = sorted(all_memories, key=score_album, reverse=True)
    return ranked[0] if ranked else all_memories[0]


def select_daily_album(all_memories: List[dict]) -> dict:
    """Picks ONE random album per calendar day deterministically based on today's YYYY-MM-DD date."""
    sorted_memories = sorted(all_memories, key=lambda m: str(m.get("id", "")))
    today_str = datetime.now().strftime("%Y-%m-%d")
    day_hash = int(hashlib.sha256(today_str.encode("utf-8")).hexdigest(), 16)
    return sorted_memories[day_hash % len(sorted_memories)]


def needs_geo_or_weather(msg: str) -> bool:
    keywords = (
        r"\b(weather|temperature|rain|sunny|cold|hot|forecast|humidity|wind|place|where|near|around|"
        r"cafe|cafes|restaurant|park|date spot|spots|visit|go to|in |at |map|location|area|city|faridabad|delhi|mumbai)\b"
    )
    return bool(re.search(keywords, msg.lower()))


def fetch_weather_and_map_context(place_query: Optional[str] = None, lat: Optional[float] = None, lon: Optional[float] = None) -> str:
    cache_key = f"{(place_query or '').lower().strip()}_{round(lat or 0, 2)}_{round(lon or 0, 2)}"
    if cache_key in _geo_cache:
        return _geo_cache[cache_key]

    headers = {"User-Agent": "TheUsSpaceApp/2.0"}
    location_name = place_query or "Current Location"

    try:
        if place_query:
            geo_url = "https://geocoding-api.open-meteo.com/v1/search"
            geo_res = requests.get(geo_url, params={"name": place_query, "count": 1, "language": "en", "format": "json"}, timeout=3).json()
            results = geo_res.get("results", [])
            if results:
                lat = float(results[0]["latitude"])
                lon = float(results[0]["longitude"])
                admin = results[0].get("admin1", "")
                country = results[0].get("country", "")
                location_name = f"{results[0].get('name')}, {admin}, {country}".strip(", ")
            else:
                nom = requests.get(
                    "https://nominatim.openstreetmap.org/search",
                    params={"q": place_query, "format": "json", "limit": 1},
                    headers=headers,
                    timeout=3
                ).json()
                if nom:
                    lat = float(nom[0]["lat"])
                    lon = float(nom[0]["lon"])
                    location_name = nom[0].get("display_name", place_query)

        if lat is None or lon is None:
            return ""

        context_parts = [f"📍 Location: {location_name} (Lat: {lat:.4f}, Lon: {lon:.4f})"]

        weather_res = requests.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude": lat,
                "longitude": lon,
                "current_weather": "true",
                "daily": "temperature_2m_max,temperature_2m_min,precipitation_probability_max",
                "timezone": "auto"
            },
            timeout=3
        ).json()

        if "current_weather" in weather_res:
            cw = weather_res["current_weather"]
            daily = weather_res.get("daily", {})
            max_t = daily.get("temperature_2m_max", ["--"])[0]
            min_t = daily.get("temperature_2m_min", ["--"])[0]
            rain_prob = daily.get("precipitation_probability_max", [0])[0]
            context_parts.append(
                f"🌤️ Current Weather: {cw.get('temperature')}°C, Wind: {cw.get('windspeed')} km/h. "
                f"Today's High: {max_t}°C, Low: {min_t}°C, Rain Chance: {rain_prob}%."
            )

        try:
            overpass_query = f"""
            [out:json][timeout:3];
            (
              node["amenity"~"cafe|restaurant|cinema|ice_cream"](around:3500,{lat},{lon});
              node["tourism"~"attraction|viewpoint|museum"](around:4000,{lat},{lon});
              node["leisure"~"park|garden"](around:3500,{lat},{lon});
            );
            out body 18;
            """
            ov_res = requests.post(
                "https://overpass-api.de/api/interpreter",
                data={"data": overpass_query},
                headers=headers,
                timeout=3.5
            ).json()

            nearby_places = []
            for el in ov_res.get("elements", []):
                tags = el.get("tags", {})
                name = tags.get("name")
                kind = tags.get("amenity") or tags.get("tourism") or tags.get("leisure")
                if name and kind:
                    nearby_places.append(f"{name} ({kind.replace('_', ' ')})")

            if nearby_places:
                unique_places = list(dict.fromkeys(nearby_places))[:12]
                context_parts.append(f"🗺️ Nearby Places & Surrounding Spots: {', '.join(unique_places)}.")
        except Exception:
            pass

        result = "\n".join(context_parts)
        _geo_cache[cache_key] = result
        return result
    except Exception:
        return ""


class PookieRequest(BaseModel):
    message: str
    lat: Optional[float] = None
    lon: Optional[float] = None
    history: Optional[List[Dict[str, Any]]] = []
    occasion: Optional[Dict[str, Any]] = None


@router.post("/pookie")
def ask_pookie(req: PookieRequest):
    try:
        memories = []
        if supabase:
            try:
                resp = supabase.table("memories").select("id, title, description, memory_date").order("memory_date", desc=True).limit(40).execute()
                for m in (resp.data or []):
                    parsed_story = extract_clean_story_and_povs(m.get("description"))
                    memories.append({
                        "id": m.get("id"),
                        "title": m.get("title"),
                        "memory_date": m.get("memory_date"),
                        "story": parsed_story["combined"]
                    })
            except Exception:
                pass

        map_weather_info = ""
        if needs_geo_or_weather(req.message):
            place_extracted = None
            try:
                ext = call_groq(
                    [
                        {"role": "system", "content": "Extract ONLY the city, neighborhood, or landmark name from the user message. If none is mentioned, reply with NONE."},
                        {"role": "user", "content": req.message}
                    ],
                    prefer_fast=True,
                    temperature=0.0,
                    max_tokens=20
                )
                if ext and ext.upper() != "NONE" and len(ext) < 50:
                    place_extracted = ext.strip("\"'.,!?")
            except Exception:
                pass

            map_weather_info = fetch_weather_and_map_context(place_query=place_extracted, lat=req.lat, lon=req.lon)

        occ_str = ""
        if req.occasion and req.occasion.get("title"):
            occ_str = f"🎉 TODAY'S SPECIAL OCCASION: {req.occasion.get('title')} - {req.occasion.get('notes', '')}"

        system_prompt = f"""You are 'Pookie', the affectionate, witty, and hyper-intelligent relationship, memory, and map/weather AI companion for 'The Us Space'.
Today's Date: {datetime.now().strftime('%B %d, %Y')}.
{occ_str}

REAL-TIME MAP, SURROUNDING AREA & WEATHER DATA:
{map_weather_info if map_weather_info else "Use your comprehensive geographical knowledge of cities, neighborhoods, cafes, parks, and landmarks."}

COUPLE'S SAVED MEMORIES IN VAULT (Includes Shared Stories, His POV, and Her POV):
{memories}

INSTRUCTIONS:
1. Check BOTH the date and semantic title/story (including His POV and Her POV) when answering questions about occasions or memories.
2. If the user asks about weather or a place, provide live weather details and nearby spot recommendations.
3. Keep responses warm, loving, and concise."""

        groq_messages = [{"role": "system", "content": system_prompt}]
        for h in (req.history or [])[-6:]:
            role = "assistant" if h.get("sender") == "pookie" or h.get("role") == "assistant" else "user"
            content = h.get("text") or h.get("content") or ""
            if content:
                groq_messages.append({"role": role, "content": content})

        groq_messages.append({"role": "user", "content": req.message})

        reply_text = call_groq(groq_messages, prefer_fast=False, temperature=0.7, max_tokens=600)

        matched_memory_id = None
        for m in memories:
            if m.get("title") and m["title"].lower() in reply_text.lower():
                matched_memory_id = m["id"]
                break

        return {
            "reply": reply_text,
            "memory_id": matched_memory_id
        }
    except Exception as e:
        return {
            "reply": f"I had a tiny hiccup ({str(e)}), try asking me again! 💕",
            "memory_id": None
        }


# --- PHASE 1 FEATURE #3: POOKIE AI VIBE-MATCHED ALBUM SOUNDTRACK ---
class AlbumVibeRequest(BaseModel):
    memory_id: Optional[str] = None
    title: str = ""
    memory_date: str = ""
    description: str = ""


@router.post("/album-vibe")
def analyze_album_vibe(req: AlbumVibeRequest):
    cache_key = f"{req.memory_id}_{req.title}_{len(req.description or '')}"
    if cache_key in _vibe_cache:
        return _vibe_cache[cache_key]

    story_parts = extract_clean_story_and_povs(req.description)
    prompt = f"""Analyze this couple's memory album and select the best soothing instrumental soundtrack vibe.
Album Title: {req.title}
Album Date: {req.memory_date}
Album Perspectives: {story_parts['combined']}

Available Vibe Keys:
- "romance": Velvet Rose (tender, romantic, date night, anniversary, sweet affection)
- "celebration": Golden Sparkle (birthday, party, milestone, festive, joyful laughter)
- "cozy": Midnight Rain (rainy day, coffee/chai cafe, late-night talks, cozy indoor warmth)
- "adventure": Sunset Horizon (road trip, outdoor walk, travel, exploring, park/nursery)
- "nostalgia": Starlight Lullaby (deep emotional reflection, missing each other, long-distance)

Reply ONLY with valid JSON in this exact format:
{{"vibe_key": "romance|celebration|cozy|adventure|nostalgia", "vibe_label": "A short 3-to-4 word poetic soundtrack title matching this specific memory"}}"""

    try:
        raw = call_groq(
            [
                {"role": "system", "content": "Output ONLY valid JSON with keys vibe_key and vibe_label."},
                {"role": "user", "content": prompt}
            ],
            prefer_fast=True,
            temperature=0.3,
            max_tokens=80
        )
        json_match = re.search(r"\{[\s\S]*\}", raw)
        if json_match:
            parsed = json.loads(json_match.group(0))
            vibe_key = parsed.get("vibe_key", "romance")
            if vibe_key not in ("romance", "celebration", "cozy", "adventure", "nostalgia"):
                vibe_key = "romance"
            result = {
                "vibe_key": vibe_key,
                "vibe_label": str(parsed.get("vibe_label") or "Velvet Rose · Music Box")[:36]
            }
            _vibe_cache[cache_key] = result
            return result
    except Exception as e:
        print(f"Album vibe AI fallback: {e}")

    return {"vibe_key": "romance", "vibe_label": "Velvet Rose · Music Box"}


# --- PHASE 1 FEATURE #4: POOKIE "DATE CONCIERGE" MODE IN PLANNER ---
class DateConciergeRequest(BaseModel):
    plan_title: str = "Our Date Plan"
    rough_notes: str = ""
    city: str = ""
    target_date: str = ""
    lat: Optional[float] = None
    lon: Optional[float] = None


@router.post("/planner/concierge")
def generate_concierge_itinerary(req: DateConciergeRequest):
    try:
        search_place = req.city.strip()
        if not search_place and req.rough_notes:
            # Try quick extraction of city/neighborhood from rough notes
            try:
                ext = call_groq(
                    [
                        {"role": "system", "content": "Extract ONLY the city or neighborhood name from the text. If none is mentioned, reply with Faridabad."},
                        {"role": "user", "content": f"{req.plan_title} - {req.rough_notes}"}
                    ],
                    prefer_fast=True,
                    temperature=0.0,
                    max_tokens=15
                ).strip("\"'.,!?")
                if ext and ext.upper() != "NONE":
                    search_place = ext
            except Exception:
                search_place = "Faridabad"

        live_context = fetch_weather_and_map_context(place_query=search_place or "Faridabad", lat=req.lat, lon=req.lon)

        prompt = f"""You are Pookie's Romantic Date Concierge for 'The Us Space'.
Transform the couple's rough notes into a warm, structured, timed Date Itinerary ready for their shared Notepad.

Date Plan Title: {req.plan_title}
Target Date / Timeframe: {req.target_date or 'Upcoming Date'}
Target City / Area: {search_place or 'Local Area'}
Couple's Rough Notes & Ideas:
{req.rough_notes or 'Surprise romantic date with cozy food, a scenic walk, and sweet moments together.'}

LIVE WEATHER & REAL NEARBY SPOTS FROM MAP:
{live_context if live_context else 'Suggest charming cafe, park, and dining ideas suited to the area.'}

FORMAT REQUIREMENTS:
- Write clean, readable plain text (with cute emojis and clear section headers) designed for a lined notepad.
- Include a brief Weather & Outfit Tip at the top.
- Provide a step-by-step Timed Schedule (e.g., 4:30 PM, 6:00 PM, 7:30 PM) incorporating their rough notes AND specific real cafe/park/restaurant suggestions from the map data.
- End with a sweet "Pookie's Romance Tip" for the two of them."""

        formatted_plan = call_groq(
            [
                {"role": "system", "content": "You are an expert romantic date concierge. Output clean, well-spaced notepad text."},
                {"role": "user", "content": prompt}
            ],
            prefer_fast=False,
            temperature=0.75,
            max_tokens=850
        )
        return {"itinerary": formatted_plan}
    except Exception as e:
        return {"itinerary": f"✨ {req.plan_title} ✨\n\n{req.rough_notes}\n\n(Pookie Concierge note: {str(e)})"}


@router.get("/chronicle")
def generate_chronicle(
    occasion_title: Optional[str] = Query(None),
    occasion_date: Optional[str] = Query(None),
    occasion_notes: Optional[str] = Query(None)
):
    try:
        if not supabase:
            return {"article": "Database offline.", "memory": None, "occasion": None}

        resp = supabase.table("memories").select("*, memory_media(*)").order("memory_date", desc=True).execute()
        all_memories = resp.data or []
        if not all_memories:
            return {"article": "Add your first memory to print the Chronicle!", "memory": None, "occasion": None}

        occasion_obj = None
        if occasion_title:
            occasion_obj = {
                "title": occasion_title,
                "date": occasion_date or datetime.now().strftime("%m-%d"),
                "desc": occasion_notes or f"Celebrating {occasion_title}!"
            }
            chosen_memory = select_best_memory_for_occasion(
                all_memories,
                occasion_title=occasion_title,
                occasion_date=occasion_obj["date"],
                occasion_notes=occasion_notes or ""
            )
        else:
            chosen_memory = select_daily_album(all_memories)

        story_info = extract_clean_story_and_povs(chosen_memory.get("description"))

        prompt = f"""Write a romantic, engaging vintage newspaper front-page article for 'The Daily Chronicle'.
CRITICAL LENGTH REQUIREMENT: You MUST write EXACTLY 4 detailed, expressive paragraphs separated by blank lines (\\n\\n).
Do NOT include a headline or title at the top. Use markdown **bold** and *italics* naturally.

Selected Album Title: {chosen_memory.get('title')}
Album Date: {chosen_memory.get('memory_date')}
Album Story & Perspectives:
{story_info['combined']}
{f"SPECIAL OCCASION EDITION: Today we are celebrating '{occasion_obj['title']}' (Context: {occasion_obj['desc']}). Connect the special occasion seamlessly with the selected album's story and emotions!" if occasion_obj else ""}

Structure your 4 paragraphs as follows:
- Paragraph 1: Set the scene, atmosphere, and excitement of the day this memory took place.
- Paragraph 2: Dive into the specific highlights, food, places, and sweet moments from the story.
- Paragraph 3: Weave in both partners' perspectives (His POV & Her POV if provided), candid laughter, and warmth.
- Paragraph 4: A heartfelt reflection on why this chapter in our vault remains unforgettable."""

        article = call_groq(
            [
                {"role": "system", "content": "You are the chief romantic journalist for 'The Daily Chronicle'. Always write exactly 4 rich paragraphs separated by double newlines."},
                {"role": "user", "content": prompt}
            ],
            prefer_fast=False,
            temperature=0.8,
            max_tokens=1100
        )

        return {
            "memory": chosen_memory,
            "article": article,
            "occasion": occasion_obj
        }
    except Exception as e:
        print(f"Chronicle error: {e}")
        return {"article": "The printing press is warming up...", "memory": None, "occasion": None}