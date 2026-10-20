import os
import re
import json
import time
import random
import asyncio
import requests
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Response, Query
from typing import Optional

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
    from backend.services.google_cloud import get_drive_service, upload_to_drive
except ImportError:
    from services.google_cloud import get_drive_service, upload_to_drive

try:
    from backend.services.ws_manager import manager
except ImportError:
    try:
        from services.ws_manager import manager
    except ImportError:
        manager = None

router = APIRouter(prefix="/api/widget")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WIDGET_STATE_FILE = os.path.join(BASE_DIR, ".media_cache", "pocket_locket_state.json")
os.makedirs(os.path.dirname(WIDGET_STATE_FILE), exist_ok=True)

IDLE_THRESHOLD_SECONDS = 8 * 3600  # 8 hours before Pookie's Idle Magic takes over


def _load_widget_state() -> dict:
    if os.path.isfile(WIDGET_STATE_FILE):
        try:
            with open(WIDGET_STATE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"active_drop": None, "history": [], "partner_city": "Faridabad"}


def _save_widget_state(state: dict):
    try:
        with open(WIDGET_STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False, indent=2)
    except Exception:
        pass


def _generate_idle_magic(partner_city: str = "Faridabad") -> dict:
    """
    Pookie's Autonomous Idle Magic when no note/selfie has been dropped in the last 8 hours:
    1. Late-Night / Good-Morning Sync
    2. Live Partner Weather Care Prompt
    3. Throwback Memory Roulette / Story Quote Spotlight
    """
    hour = datetime.now().hour

    # 1. Late-Night / Early Morning Sync
    if hour >= 23 or hour < 5:
        return {
            "mode": "idle_night",
            "badge": "🌙 Pookie's Night Watch",
            "title": "Under the Same Stars ✨",
            "note": "Long day? Send a quick goodnight note or sleepy selfie before bed 💕",
            "color": "#1e1b4b",
            "textColor": "#f8fafc",
            "image_url": None,
            "updated_at": datetime.now().strftime("%I:%M %p"),
        }

    # 2. Check Partner City Live Weather for Care Prompts
    try:
        geo = requests.get(
            "https://geocoding-api.open-meteo.com/v1/search",
            params={"name": partner_city, "count": 1},
            timeout=2.5,
        ).json()
        if geo.get("results"):
            lat = geo["results"][0]["latitude"]
            lon = geo["results"][0]["longitude"]
            w = (
                requests.get(
                    "https://api.open-meteo.com/v1/forecast",
                    params={
                        "latitude": lat,
                        "longitude": lon,
                        "current_weather": "true",
                    },
                    timeout=2.5,
                )
                .json()
                .get("current_weather", {})
            )
            temp = w.get("temperature")
            code = w.get("weathercode", 0)
            if code >= 51:
                return {
                    "mode": "idle_weather",
                    "badge": f"🌧️ Live Sky in {partner_city}",
                    "title": f"It's Raining ({temp}°C)",
                    "note": f"It's raining in {partner_city} right now! Remind your love to grab hot chai ☕💖",
                    "color": "#e0f2fe",
                    "textColor": "#0c4a6e",
                    "image_url": None,
                    "updated_at": datetime.now().strftime("%I:%M %p"),
                }
            if temp is not None and temp >= 36:
                return {
                    "mode": "idle_weather",
                    "badge": f"☀️ Live Sky in {partner_city}",
                    "title": f"Warm Day ({temp}°C)",
                    "note": f"It's {temp}°C in {partner_city}! Remind your partner to stay hydrated 🧋",
                    "color": "#fef3c7",
                    "textColor": "#78350f",
                    "image_url": None,
                    "updated_at": datetime.now().strftime("%I:%M %p"),
                }
    except Exception:
        pass

    # 3. Throwback Memory Roulette / Story Quote Spotlight from Vault
    if supabase:
        try:
            resp = (
                supabase.table("memories")
                .select("*, memory_media(*)")
                .limit(35)
                .execute()
            )
            albums = [a for a in (resp.data or []) if a.get("memory_media")]
            if albums:
                chosen = random.choice(albums)
                clean_desc = re.sub(
                    r"\n?<!--US_META:[\s\S]*?-->", "", chosen.get("description") or ""
                ).strip()
                visuals = [
                    m["file_url"]
                    for m in chosen.get("memory_media", [])
                    if not m.get("file_url", "").startswith("voice#")
                ]
                img_url = visuals[0] if visuals else None
                return {
                    "mode": "idle_throwback",
                    "badge": f"🎞️ Throwback · {chosen.get('memory_date', '')}",
                    "title": chosen.get("title", "Our Memory"),
                    "note": (
                        (clean_desc[:110] + "…")
                        if len(clean_desc) > 110
                        else (clean_desc or "Reliving one of our favorite chapters 🌸")
                    ),
                    "color": "#fff1f2",
                    "textColor": "#881337",
                    "image_url": img_url,
                    "updated_at": "Pookie's Throwback",
                }
        except Exception:
            pass

    return {
        "mode": "idle_default",
        "badge": "🌸 Pookie's Pocket Locket",
        "title": "Thinking of You",
        "note": "Tap to drop a quick selfie or sticky note onto your partner's home screen!",
        "color": "#fdf2f8",
        "textColor": "#831843",
        "image_url": None,
        "updated_at": "Ready",
    }


@router.get("/state")
def get_widget_state(force_idle: bool = Query(False)):
    state = _load_widget_state()
    active = state.get("active_drop")
    now_ts = time.time()

    if (
        not force_idle
        and active
        and (now_ts - active.get("timestamp", 0) < IDLE_THRESHOLD_SECONDS)
    ):
        return {
            "status": "active",
            "card": active,
            "partner_city": state.get("partner_city", "Faridabad"),
            "history": (state.get("history") or [])[:8],
        }

    idle_card = _generate_idle_magic(state.get("partner_city", "Faridabad"))
    return {
        "status": "idle",
        "card": idle_card,
        "partner_city": state.get("partner_city", "Faridabad"),
        "history": (state.get("history") or [])[:8],
    }


@router.post("/drop")
async def create_widget_drop(
    note: str = Form(""),
    sender_name: str = Form("Your Love"),
    color: str = Form("#fff1f2"),
    partner_city: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
):
    """Posts a new Live Polaroid Selfie or Sticky Note to Pookie's Pocket Locket."""
    state = _load_widget_state()
    if partner_city:
        state["partner_city"] = partner_city.strip()

    image_url = None
    if file and file.filename:

        def _upload():
            drive_service = get_drive_service()
            return upload_to_drive(
                file.file,
                filename=f"locket_{int(time.time())}_{file.filename}",
                mime_type=file.content_type or "image/jpeg",
                drive_service=drive_service,
            )

        image_url = await asyncio.to_thread(_upload)
        await file.close()

    drop_card = {
        "id": f"drop_{int(time.time())}",
        "mode": "polaroid" if image_url else "sticky_note",
        "badge": f"💌 From {sender_name}",
        "title": "Live Polaroid Drop 📸" if image_url else "Sticky Note Pin 📝",
        "note": note.strip()
        or ("Sent you a live moment 💕" if image_url else "Thinking of you right now!"),
        "color": color,
        "textColor": "#1c1917",
        "image_url": image_url,
        "timestamp": time.time(),
        "updated_at": datetime.now().strftime("%I:%M %p"),
        "saved_to_vault": False,
    }

    state["active_drop"] = drop_card
    history = state.get("history") or []
    history.insert(0, drop_card)
    state["history"] = history[:15]
    _save_widget_state(state)

    # Broadcast live event via WebSocket so partner's open app/lock screen alerts immediately
    if manager:
        try:
            await manager.broadcast(
                json.dumps({"type": "widget_drop", "card": drop_card})
            )
        except Exception:
            pass

    return {"status": "dropped", "card": drop_card}


@router.post("/save-to-vault")
def save_drop_to_daily_snaps_album():
    """
    1-Tap Archive: Saves the current Pocket Locket photo into a Constant Album
    named 'Daily Widget Snaps 📱' in the Memory Vault.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Database offline")

    state = _load_widget_state()
    active = state.get("active_drop")
    if not active or not active.get("image_url"):
        raise HTTPException(
            status_code=400, detail="No active widget photo to archive."
        )

    album_title = "Daily Widget Snaps 📱"
    resp = supabase.table("memories").select("*").eq("title", album_title).execute()

    if resp.data:
        album_id = resp.data[0]["id"]
    else:
        today_str = datetime.now().strftime("%Y-%m-%d")
        desc = 'Our fleeting daily selfies and Pocket Locket moments.\n<!--US_META:{"isConstant":true}-->'
        created = (
            supabase.table("memories")
            .insert(
                {"title": album_title, "memory_date": today_str, "description": desc}
            )
            .execute()
        )
        album_id = created.data[0]["id"]

    supabase.table("memory_media").insert(
        {"memory_id": album_id, "file_url": active["image_url"]}
    ).execute()

    active["saved_to_vault"] = True
    _save_widget_state(state)

    return {"status": "archived", "album_id": album_id, "album_title": album_title}


@router.get("/card.svg")
def render_live_widget_svg():
    """
    Renders a live, self-contained 400x400 SVG Home Screen Widget Card
    that Android KWGT / Web Widget and iOS Scriptable can render directly on the phone home screen.
    """
    data = get_widget_state()
    card = data["card"]
    bg = card.get("color") or "#fff1f2"
    fg = card.get("textColor") or "#1c1917"
    badge = (
        (card.get("badge") or "🌸 The Us Space")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
    )
    title = (
        (card.get("title") or "Pocket Locket")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
    )
    note = (card.get("note") or "").replace("&", "&amp;").replace("<", "&lt;")
    updated = card.get("updated_at") or ""

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="{bg}"/>
          <stop offset="100%" stop-color="#ffffff"/>
        </linearGradient>
      </defs>
      <rect width="400" height="400" rx="48" fill="url(#g)" stroke="#fda4af" stroke-width="4"/>
      <rect x="28" y="28" width="220" height="32" rx="16" fill="#f43f5e" fill-opacity="0.12"/>
      <text x="44" y="49" font-family="sans-serif" font-size="13" font-weight="bold" fill="#e11d48">{badge}</text>
      <text x="32" y="105" font-family="Georgia, serif" font-size="26" font-weight="bold" fill="{fg}">{title[:24]}</text>
      <foreignObject x="32" y="125" width="336" height="210">
        <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: sans-serif; font-size: 18px; line-height: 1.45; color: {fg}; word-wrap: break-word;">
          {note}
        </div>
      </foreignObject>
      <text x="32" y="368" font-family="monospace" font-size="12" fill="#78716c">THE US SPACE · {updated}</text>
    </svg>"""

    return Response(
        content=svg, media_type="image/svg+xml", headers={"Cache-Control": "no-cache"}
    )
