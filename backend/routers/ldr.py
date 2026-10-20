import os
import json
import time
import math
import requests
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import re
from fastapi import Request
from fastapi.responses import StreamingResponse

try:
    from backend.routers.ai import call_groq, fetch_weather_and_map_context
except ImportError:
    from routers.ai import call_groq, fetch_weather_and_map_context

try:
    from backend.services.ws_manager import manager
except ImportError:
    try:
        from services.ws_manager import manager
    except ImportError:
        manager = None

router = APIRouter(prefix="/ldr")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LDR_STATE_FILE = os.path.join(BASE_DIR, ".media_cache", "ldr_hub_state.json")
os.makedirs(os.path.dirname(LDR_STATE_FILE), exist_ok=True)

_sky_cache = {"ts": 0, "key": "", "data": None}


def _default_ldr_state() -> dict:
    return {
        "cities": {
            "city_a": "Faridabad",
            "label_a": "Me",
            "city_b": "Delhi",
            "label_b": "Partner",
        },
        "meetup": {
            "target_date": "2026-11-14T18:00",
            "destination": "Our Next Meetup ✨",
            "flight_code": "US-0504",
            "notes": "Counting down every second until I hold you again",
        },
        "bucket_list": [
            {
                "id": "bl_1",
                "title": "Late-night long drive with our favorite playlist 🚗🌙",
                "category": "Adventure",
                "completed": False,
                "linked_memory_id": None,
                "created_at": "2026-10-01",
            },
            {
                "id": "bl_2",
                "title": "Cook a full dinner together on video call 🍝",
                "category": "LDR Date",
                "completed": False,
                "linked_memory_id": None,
                "created_at": "2026-10-05",
            },
        ],
        "envelopes": [
            {
                "id": "env_1",
                "prompt": "Open when you miss me late at night 🌙",
                "sender": "Your Love",
                "letter": "Close your eyes and take a deep breath. We are looking at the exact same moon right now, and every day brings us one day closer to our next hug. I love you endlessly 💖",
                "media_url": "",
                "is_opened": False,
                "opened_at": None,
                "created_at": "2026-10-10",
            }
        ],
        "pending_hugs": [],
    }


def _load_state() -> dict:
    if os.path.isfile(LDR_STATE_FILE):
        try:
            with open(LDR_STATE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                defaults = _default_ldr_state()
                for k, v in defaults.items():
                    if k not in data:
                        data[k] = v
                return data
        except Exception:
            pass
    return _default_ldr_state()


def _save_state(state: dict):
    try:
        with open(LDR_STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False, indent=2)
    except Exception:
        pass


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> int:
    r = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    )
    return max(1, round(2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))))


def _fetch_city_weather(city_name: str) -> dict:
    try:
        geo = requests.get(
            "https://geocoding-api.open-meteo.com/v1/search",
            params={"name": city_name, "count": 1},
            timeout=2.5,
        ).json()
        results = geo.get("results") or []
        if not results:
            return {
                "city": city_name,
                "temp": "--",
                "desc": "Clear Sky",
                "icon": "✨",
                "lat": 28.4089,
                "lon": 77.3178,
            }

        lat = float(results[0]["latitude"])
        lon = float(results[0]["longitude"])
        resolved_name = results[0].get("name", city_name)

        w_res = (
            requests.get(
                "https://api.open-meteo.com/v1/forecast",
                params={"latitude": lat, "longitude": lon, "current_weather": "true"},
                timeout=2.5,
            )
            .json()
            .get("current_weather", {})
        )

        temp = round(w_res.get("temperature", 24))
        code = w_res.get("weathercode", 0)
        is_day = w_res.get("is_day", 1) == 1

        if code >= 51:
            desc, icon = "Raining", "🌧️"
        elif code in (1, 2, 3):
            desc, icon = "Partly Cloudy", ("⛅" if is_day else "☁️")
        elif code >= 45:
            desc, icon = "Misty", "🌫️"
        else:
            desc, icon = ("Sunny" if is_day else "Starry Night"), (
                "☀️" if is_day else "🌙"
            )

        return {
            "city": resolved_name,
            "temp": temp,
            "desc": desc,
            "icon": icon,
            "lat": lat,
            "lon": lon,
        }
    except Exception:
        return {
            "city": city_name,
            "temp": "--",
            "desc": "Same Sky",
            "icon": "✨",
            "lat": 28.4089,
            "lon": 77.3178,
        }


class UpdateCitiesAndMeetupRequest(BaseModel):
    city_a: Optional[str] = None
    label_a: Optional[str] = None
    city_b: Optional[str] = None
    label_b: Optional[str] = None
    target_date: Optional[str] = None
    destination: Optional[str] = None
    flight_code: Optional[str] = None
    notes: Optional[str] = None


class BucketItemRequest(BaseModel):
    title: str
    category: str = "Date Idea"


class UpdateBucketItemRequest(BaseModel):
    completed: Optional[bool] = None
    linked_memory_id: Optional[str] = None
    title: Optional[str] = None


class CreateEnvelopeRequest(BaseModel):
    prompt: str
    sender: str = "Your Love"
    letter: str
    media_url: Optional[str] = ""


class HugRequest(BaseModel):
    sender_id: str
    sender_name: str = "Your Partner"


class ConciergeRequest(BaseModel):
    rough_notes: str
    city: Optional[str] = "Faridabad"
    current_content: Optional[str] = ""


@router.get("/status")
def get_ldr_status():
    state = _load_state()
    c_cfg = state["cities"]
    cache_key = f"{c_cfg['city_a']}_{c_cfg['city_b']}"

    now = time.time()
    if (
        _sky_cache["data"]
        and _sky_cache["key"] == cache_key
        and (now - _sky_cache["ts"] < 600)
    ):
        sky_data = _sky_cache["data"]
    else:
        wa = _fetch_city_weather(c_cfg["city_a"])
        wb = _fetch_city_weather(c_cfg["city_b"])
        dist_km = _haversine_km(wa["lat"], wa["lon"], wb["lat"], wb["lon"])
        sky_data = {
            "city_a": {**wa, "label": c_cfg.get("label_a", "Me")},
            "city_b": {**wb, "label": c_cfg.get("label_b", "Partner")},
            "distance_km": dist_km,
        }
        _sky_cache["ts"] = now
        _sky_cache["key"] = cache_key
        _sky_cache["data"] = sky_data

    return {
        "sky": sky_data,
        "meetup": state["meetup"],
        "bucket_list": state["bucket_list"],
        "envelopes": state["envelopes"],
        "pending_hugs": state.get("pending_hugs", []),
    }


@router.put("/config")
def update_ldr_config(req: UpdateCitiesAndMeetupRequest):
    state = _load_state()
    if req.city_a is not None:
        state["cities"]["city_a"] = req.city_a.strip() or "Faridabad"
    if req.label_a is not None:
        state["cities"]["label_a"] = req.label_a.strip() or "Me"
    if req.city_b is not None:
        state["cities"]["city_b"] = req.city_b.strip() or "Delhi"
    if req.label_b is not None:
        state["cities"]["label_b"] = req.label_b.strip() or "Partner"

    if req.target_date is not None:
        state["meetup"]["target_date"] = req.target_date
    if req.destination is not None:
        state["meetup"]["destination"] = req.destination.strip()
    if req.flight_code is not None:
        state["meetup"]["flight_code"] = req.flight_code.strip()
    if req.notes is not None:
        state["meetup"]["notes"] = req.notes.strip()

    _sky_cache["ts"] = 0
    _save_state(state)
    return get_ldr_status()


@router.post("/bucket-list")
def add_bucket_item(req: BucketItemRequest):
    state = _load_state()
    new_item = {
        "id": f"bl_{int(time.time() * 1000)}",
        "title": req.title.strip(),
        "category": req.category.strip() or "Dream",
        "completed": False,
        "linked_memory_id": None,
        "created_at": datetime.now().strftime("%Y-%m-%d"),
    }
    state["bucket_list"].insert(0, new_item)
    _save_state(state)
    return new_item


@router.put("/bucket-list/{item_id}")
def update_bucket_item(item_id: str, req: UpdateBucketItemRequest):
    state = _load_state()
    for item in state["bucket_list"]:
        if item["id"] == item_id:
            if req.completed is not None:
                item["completed"] = req.completed
            if req.linked_memory_id is not None:
                item["linked_memory_id"] = req.linked_memory_id or None
            if req.title is not None:
                item["title"] = req.title.strip()
            _save_state(state)
            return item
    raise HTTPException(status_code=404, detail="Bucket list item not found")


@router.delete("/bucket-list/{item_id}")
def delete_bucket_item(item_id: str):
    state = _load_state()
    state["bucket_list"] = [i for i in state["bucket_list"] if i["id"] != item_id]
    _save_state(state)
    return {"status": "deleted"}


@router.post("/envelopes")
def create_envelope(req: CreateEnvelopeRequest):
    state = _load_state()
    env = {
        "id": f"env_{int(time.time() * 1000)}",
        "prompt": req.prompt.strip(),
        "sender": req.sender.strip() or "Your Love",
        "letter": req.letter.strip(),
        "media_url": (req.media_url or "").strip(),
        "is_opened": False,
        "opened_at": None,
        "created_at": datetime.now().strftime("%b %d, %Y"),
    }
    state["envelopes"].insert(0, env)
    _save_state(state)
    return env


@router.post("/envelopes/{env_id}/open")
async def mark_envelope_opened(env_id: str):
    state = _load_state()
    opened_env = None
    for env in state["envelopes"]:
        if env["id"] == env_id:
            if not env.get("is_opened"):
                env["is_opened"] = True
                env["opened_at"] = datetime.now().strftime("%b %d, %I:%M %p")
            opened_env = env
            break

    if not opened_env:
        raise HTTPException(status_code=404, detail="Envelope not found")

    _save_state(state)
    if manager:
        try:
            await manager.broadcast(
                json.dumps({"type": "envelope_opened", "envelope": opened_env})
            )
        except Exception:
            pass
    return opened_env


@router.delete("/envelopes/{env_id}")
def delete_envelope(env_id: str):
    state = _load_state()
    state["envelopes"] = [e for e in state["envelopes"] if e["id"] != env_id]
    _save_state(state)
    return {"status": "deleted"}


@router.post("/hug")
async def send_touch_across_miles(req: HugRequest):
    state = _load_state()
    hug_entry = {
        "id": f"hug_{int(time.time() * 1000)}",
        "sender_id": req.sender_id,
        "sender_name": req.sender_name,
        "timestamp": datetime.now().strftime("%I:%M %p"),
    }
    state.setdefault("pending_hugs", []).append(hug_entry)
    state["pending_hugs"] = state["pending_hugs"][-25:]
    _save_state(state)

    if manager:
        try:
            await manager.broadcast(
                json.dumps(
                    {
                        "type": "live_hug",
                        "senderId": req.sender_id,
                        "senderName": req.sender_name,
                        "timestamp": hug_entry["timestamp"],
                    }
                )
            )
        except Exception:
            pass

    return {"status": "sent", "hug": hug_entry}


@router.post("/hugs/claim")
def claim_pending_hugs(req: HugRequest):
    """Returns and clears queued hugs sent by the partner while this user was offline."""
    state = _load_state()
    all_hugs = state.get("pending_hugs") or []
    for_me = [h for h in all_hugs if h.get("sender_id") != req.sender_id]
    remaining = [h for h in all_hugs if h.get("sender_id") == req.sender_id]
    if for_me:
        state["pending_hugs"] = remaining
        _save_state(state)
    return {"claimed_count": len(for_me), "hugs": for_me}


@router.post("/concierge")
def generate_pookie_date_itinerary(req: ConciergeRequest):
    """Pookie 'Date Concierge' Mode: transforms rough date ideas into a weather-aware timed itinerary."""
    geo_weather = fetch_weather_and_map_context(place_query=req.city or "Faridabad")
    prompt = f"""You are Pookie, the romantic AI Date Concierge for 'The Us Space'.
Transform the couple's rough date notes into a beautifully structured, timed Date Itinerary for their Notepad.

Target City / Area: {req.city or 'Faridabad'}
Real-Time Weather & Nearby Spots Context:
{geo_weather if geo_weather else 'Use your knowledge of cozy cafes, scenic walks, and romantic date spots.'}

Couple's Rough Notes / Vibe:
"{req.rough_notes}"

Current Notepad Text (if any):
"{(req.current_content or '')[:400]}"

Output a clean, ready-to-use itinerary with:
1. A cute title & weather/outfit tip at the top.
2. 3 to 5 timed stops (e.g., 5:00 PM — Sunset Coffee at...) with specific spot suggestions and a sweet activity prompt.
3. A 'Long-Distance Alternative 💻💖' mini-tip at the bottom in case they are doing this date virtually.
Keep it concise, warm, and formatted with clean emojis (no markdown tables)."""

    plan_text = call_groq(
        [
            {
                "role": "system",
                "content": "You are Pookie, an expert romantic date planner.",
            },
            {"role": "user", "content": prompt},
        ],
        prefer_fast=False,
        temperature=0.75,
        max_tokens=700,
    )
    return {"itinerary": plan_text}


def _extract_x_twitter_video(url: str) -> Optional[dict]:
    """Extracts direct MP4 video stream from x.com or twitter.com status links without needing cookies."""
    m = re.search(r"(?:x\.com|twitter\.com)/[^/]+/status/(\d+)", url)
    if not m:
        return None
    tweet_id = m.group(1)
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}

    # Strategy 1: vxtwitter API (instant direct MP4 URL)
    try:
        r = requests.get(
            f"https://api.vxtwitter.com/Twitter/status/{tweet_id}",
            headers=headers,
            timeout=6,
        )
        if r.status_code == 200:
            data = r.json()
            for media in data.get("media_extended") or []:
                if media.get("type") in ("video", "gif") and media.get("url"):
                    return {
                        "stream_url": media["url"],
                        "title": (data.get("text") or f"X Video {tweet_id}")[:80],
                    }
    except Exception:
        pass

    # Strategy 2: Twitter Syndication Embed JSON
    try:
        r2 = requests.get(
            f"https://cdn.syndication.twimg.com/tweet-result?id={tweet_id}&token=x",
            headers=headers,
            timeout=6,
        )
        if r2.status_code == 200:
            t_data = r2.json()
            for media in t_data.get("mediaDetails") or []:
                variants = (media.get("video_info") or {}).get("variants") or []
                mp4s = [
                    v
                    for v in variants
                    if v.get("content_type") == "video/mp4" and v.get("url")
                ]
                if mp4s:
                    mp4s.sort(key=lambda x: x.get("bitrate", 0), reverse=True)
                    return {
                        "stream_url": mp4s[0]["url"],
                        "title": (t_data.get("text") or f"X Video {tweet_id}")[:80],
                    }
    except Exception:
        pass

    return None


@router.get("/resolve-video")
def resolve_universal_video_url(url: str):
    """
    Resolves X.com/Twitter, Instagram, Reddit, TikTok, or any web video link into a direct
    playable MP4 stream so both partners can pause and seek with Spacebar & Arrow keys.
    """
    clean = (url or "").strip()
    if not clean:
        raise HTTPException(status_code=400, detail="Empty URL")

    # 1. Fast X.com / Twitter Extractor
    if "x.com/" in clean or "twitter.com/" in clean:
        x_info = _extract_x_twitter_video(clean)
        if x_info and x_info.get("stream_url"):
            return {
                "resolved_type": "video",
                "stream_url": x_info["stream_url"],
                "title": x_info.get("title", "X.com Video"),
            }

    # 2. General yt-dlp Extractor (Instagram, Reddit, Streamable, TikTok, etc.)
    try:
        import yt_dlp

        opts = {
            "format": "best[protocol^=http][ext=mp4]/b[ext=mp4]/b/best",
            "quiet": True,
            "no_warnings": True,
            "noplaylist": True,
            "nocheckcertificate": True,
        }
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(clean, download=False)
            if info:
                direct_url = info.get("url")
                if not direct_url and info.get("entries"):
                    direct_url = info["entries"][0].get("url")
                if direct_url:
                    return {
                        "resolved_type": "video",
                        "stream_url": direct_url,
                        "title": info.get("title") or "Shared Video",
                    }
    except Exception:
        pass

    return {
        "resolved_type": "iframe",
        "stream_url": clean,
        "title": "Shared Web Stream",
    }


@router.get("/proxy-video")
def proxy_external_video_stream(url: str, request: Request):
    """
    Streams external MP4 URLs (like video.twimg.com) with Range header support
    so browsers never block playback or keyboard seeking due to CORS/Referer policies.
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Referer": "https://x.com/",
    }
    range_header = request.headers.get("range")
    if range_header:
        headers["Range"] = range_header

    upstream = requests.get(url, headers=headers, stream=True, timeout=20)
    resp_headers = {"Accept-Ranges": "bytes", "Access-Control-Allow-Origin": "*"}
    for h in ("Content-Length", "Content-Range", "Content-Type"):
        if h in upstream.headers:
            resp_headers[h] = upstream.headers[h]

    return StreamingResponse(
        upstream.iter_content(chunk_size=256 * 1024),
        status_code=upstream.status_code,
        media_type=upstream.headers.get("Content-Type", "video/mp4"),
        headers=resp_headers,
    )
