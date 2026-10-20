import os
import re
import json
import time
import base64
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
        supabase = create_client(os.getenv("SUPABASE_URL", ""), os.getenv("SUPABASE_KEY", ""))

try:
    from backend.services.google_cloud import get_drive_service, upload_to_drive, fetch_drive_file_bytes
except ImportError:
    from services.google_cloud import get_drive_service, upload_to_drive, fetch_drive_file_bytes

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

IDLE_THRESHOLD_SECONDS = 8 * 3600


def _load_widget_state() -> dict:
    if os.path.isfile(WIDGET_STATE_FILE):
        try:
            with open(WIDGET_STATE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                data.setdefault("drops_by_role", {})
                data.setdefault("history", [])
                data.setdefault("partner_city", "Faridabad")
                return data
        except Exception:
            pass
    return {"drops_by_role": {}, "active_drop": None, "history": [], "partner_city": "Faridabad"}


def _save_widget_state(state: dict):
    try:
        with open(WIDGET_STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False, indent=2)
    except Exception:
        pass


def _generate_idle_magic(partner_city: str = "Faridabad") -> dict:
    """
    When neither partner has uploaded a photo/note recently, Pookie generates a shared
    romantic note, weather care prompt, or Vault throwback for both partners!
    """
    hour = datetime.now().hour

    if hour >= 23 or hour < 5:
        return {
            "mode": "pookie_idle",
            "badge": "🌙 Pookie's Night Note for Both",
            "title": "Time for Bed, Lovebirds!",
            "note": "Neither of you posted tonight — close your eyes, send a quick goodnight kiss, and dream of our next meetup 💖",
            "color": "#1e1b4b",
            "textColor": "#f8fafc",
            "image_url": None,
            "updated_at": datetime.now().strftime("%I:%M %p")
        }

    if supabase:
        try:
            resp = supabase.table("memories").select("*, memory_media(*)").limit(35).execute()
            albums = [a for a in (resp.data or []) if a.get("memory_media")]
            if albums:
                chosen = random.choice(albums)
                clean_desc = re.sub(r"\n?<!--US_META:[\s\S]*?-->", "", chosen.get("description") or "").strip()
                visuals = [
                    m["file_url"] for m in chosen.get("memory_media", [])
                    if not m.get("file_url", "").startswith("voice#")
                ]
                img_url = visuals[0] if visuals else None
                return {
                    "mode": "pookie_idle",
                    "badge": f"🌸 Pookie's Note · {chosen.get('memory_date', '')}",
                    "title": f"Remember {chosen.get('title', 'This Day')}?",
                    "note": (clean_desc[:110] + "…") if len(clean_desc) > 110 else (clean_desc or "Pookie picked this memory for the two of you today 💕"),
                    "color": "#fff1f2",
                    "textColor": "#881337",
                    "image_url": img_url,
                    "updated_at": "Pookie's Shared Note"
                }
        except Exception:
            pass

    return {
        "mode": "pookie_idle",
        "badge": "🌸 Pookie's Note for Both",
        "title": "Distance Means So Little...",
        "note": "When someone means so much! Drop a selfie or sticky note whenever you have a free minute today 💖",
        "color": "#fff1f2",
        "textColor": "#881337",
        "image_url": None,
        "updated_at": "Pookie AI"
    }


def _select_card_for_viewer(state: dict, viewer_role: str, force_idle: bool = False) -> tuple[str, dict]:
    """
    Directional Partner Logic:
    - If viewer is 'partner_his' (Him), show what 'partner_her' (Her) uploaded!
    - If viewer is 'partner_her' (Her), show what 'partner_his' (Him) uploaded!
    - If the partner hasn't uploaded in 8 hours (or ever), fallback to the latest drop or Pookie's shared note.
    """
    if force_idle:
        return "idle", _generate_idle_magic(state.get("partner_city", "Faridabad"))

    now_ts = time.time()
    drops_by_role = state.get("drops_by_role") or {}
    opposite_role = "partner_her" if viewer_role == "partner_his" else "partner_his"

    partner_drop = drops_by_role.get(opposite_role)
    if partner_drop and (now_ts - partner_drop.get("timestamp", 0) < IDLE_THRESHOLD_SECONDS):
        return "partner_active", partner_drop

    # If opposite partner hasn't dropped recently, check if the other drop is fresh
    own_drop = drops_by_role.get(viewer_role) or state.get("active_drop")
    if own_drop and (now_ts - own_drop.get("timestamp", 0) < IDLE_THRESHOLD_SECONDS):
        return "own_active", own_drop

    return "idle", _generate_idle_magic(state.get("partner_city", "Faridabad"))


@router.get("/state")
def get_widget_state(
    viewer_role: str = Query("partner_his", description="partner_his or partner_her"),
    force_idle: bool = Query(False)
):
    state = _load_widget_state()
    status_type, card_for_me = _select_card_for_viewer(state, viewer_role, force_idle)
    drops_by_role = state.get("drops_by_role") or {}

    return {
        "status": status_type,
        "card": card_for_me,
        "his_drop": drops_by_role.get("partner_his"),
        "her_drop": drops_by_role.get("partner_her"),
        "partner_city": state.get("partner_city", "Faridabad"),
        "history": (state.get("history") or [])[:8]
    }


@router.post("/drop")
async def create_widget_drop(
    note: str = Form(""),
    sender_name: str = Form("Your Love"),
    sender_role: str = Form("partner_his"),
    color: str = Form("#fff1f2"),
    partner_city: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None)
):
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
                drive_service=drive_service
            )
        image_url = await asyncio.to_thread(_upload)
        await file.close()

    valid_role = "partner_her" if sender_role == "partner_her" else "partner_his"

    drop_card = {
        "id": f"drop_{int(time.time())}",
        "sender_role": valid_role,
        "sender_name": sender_name.strip() or ("Him" if valid_role == "partner_his" else "Her"),
        "mode": "polaroid" if image_url else "sticky_note",
        "badge": f"💌 From {sender_name.strip() or 'Your Love'}",
        "title": f"{sender_name.strip()}’s Moment 📸" if image_url else f"Note from {sender_name.strip()} 📝",
        "note": note.strip() or ("Sent you a live Polaroid 💕" if image_url else "Thinking of you right now!"),
        "color": color,
        "textColor": "#1c1917",
        "image_url": image_url,
        "timestamp": time.time(),
        "updated_at": datetime.now().strftime("%I:%M %p"),
        "saved_to_vault": False
    }

    state.setdefault("drops_by_role", {})[valid_role] = drop_card
    state["active_drop"] = drop_card
    history = state.get("history") or []
    history.insert(0, drop_card)
    state["history"] = history[:15]
    _save_widget_state(state)

    if manager:
        try:
            await manager.broadcast(json.dumps({
                "type": "widget_drop",
                "card": drop_card
            }))
        except Exception:
            pass

    return {"status": "dropped", "card": drop_card}


@router.post("/save-to-vault")
def save_drop_to_daily_snaps_album(viewer_role: str = Query("partner_his")):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database offline")

    state = _load_widget_state()
    _, active = _select_card_for_viewer(state, viewer_role, False)
    if not active or not active.get("image_url"):
        active = state.get("active_drop")
    if not active or not active.get("image_url"):
        raise HTTPException(status_code=400, detail="No active widget photo to archive.")

    album_title = "Daily Widget Snaps 📱"
    resp = supabase.table("memories").select("*").eq("title", album_title).execute()

    if resp.data:
        album_id = resp.data[0]["id"]
    else:
        today_str = datetime.now().strftime("%Y-%m-%d")
        desc = 'Our fleeting daily selfies and Pocket Locket moments.\n<!--US_META:{"isConstant":true}-->'
        created = supabase.table("memories").insert({
            "title": album_title,
            "memory_date": today_str,
            "description": desc
        }).execute()
        album_id = created.data[0]["id"]

    supabase.table("memory_media").insert({
        "memory_id": album_id,
        "file_url": active["image_url"]
    }).execute()

    active["saved_to_vault"] = True
    _save_widget_state(state)

    return {"status": "archived", "album_id": album_id, "album_title": album_title}


def _resolve_base64_thumb(image_url: Optional[str]) -> Optional[str]:
    """Embeds the Google Drive thumbnail directly as Base64 inside the 4x4 SVG card so phone widgets render the photo natively."""
    if not image_url:
        return None
    m = re.search(r"(?:id=|/d/|drive-image/)([a-zA-Z0-9_-]+)", image_url)
    if not m:
        return None
    try:
        raw_bytes, _, mime = fetch_drive_file_bytes(m.group(1), size="thumb")
        b64 = base64.b64encode(raw_bytes).decode("ascii")
        return f"data:{mime};base64,{b64}"
    except Exception:
        return None


@router.get("/card.svg")
def render_live_4x4_widget_svg(
    viewer_role: str = Query("partner_his", alias="for")
):
    """
    Renders a rich 800x800 (4x4 Home Screen Grid) Duolingo-style graphical card
    containing the partner's embedded Base64 photo, expressive typography, and Pookie badge.
    """
    state = _load_widget_state()
    _, card = _select_card_for_viewer(state, viewer_role, False)

    bg = card.get("color") or "#fff1f2"
    fg = card.get("textColor") or "#1c1917"
    badge = (card.get("badge") or "🌸 The Us Space").replace("&", "&amp;").replace("<", "&lt;")
    title = (card.get("title") or "Pocket Locket").replace("&", "&amp;").replace("<", "&lt;")
    note = (card.get("note") or "").replace("&", "&amp;").replace("<", "&lt;")
    updated = (card.get("updated_at") or "Live").replace("&", "&amp;")

    b64_img = _resolve_base64_thumb(card.get("image_url"))

    # Wrap note text into clean SVG lines so it renders in ALL native iOS/Android image widgets
    words = note.split()
    lines = []
    curr = ""
    for w in words:
        if len(curr) + len(w) + 1 <= 36:
            curr = f"{curr} {w}".strip()
        else:
            lines.append(curr)
            curr = w
        if len(lines) >= 3:
            break
    if curr and len(lines) < 4:
        lines.append(curr)

    image_block = ""
    text_y_start = 240
    if b64_img:
        image_block = f"""
        <rect x="60" y="130" width="680" height="390" rx="36" fill="#ffffff" filter="drop-shadow(0 12px 24px rgba(0,0,0,0.12))"/>
        <clipPath id="photoClip">
          <rect x="76" y="146" width="648" height="358" rx="26"/>
        </clipPath>
        <image href="{b64_img}" x="76" y="146" width="648" height="358" preserveAspectRatio="xMidYMid slice" clip-path="url(#photoClip)"/>
        """
        text_y_start = 575

    tspan_lines = "".join(
        f'<tspan x="64" dy="{0 if idx == 0 else 42}">{ln}</tspan>'
        for idx, ln in enumerate(lines)
    )

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
      <defs>
        <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="{bg}"/>
          <stop offset="100%" stop-color="#ffe4e6"/>
        </linearGradient>
      </defs>
      <rect width="800" height="800" rx="90" fill="url(#bgGrad)" stroke="#fda4af" stroke-width="8"/>
      <circle cx="710" cy="95" r="110" fill="#f43f5e" fill-opacity="0.08"/>
      <rect x="56" y="48" width="380" height="54" rx="27" fill="#f43f5e" fill-opacity="0.15"/>
      <text x="84" y="83" font-family="sans-serif" font-size="24" font-weight="bold" fill="#e11d48">{badge[:26]}</text>
      <text x="740" y="83" text-anchor="end" font-family="monospace" font-size="22" font-weight="bold" fill="#78716c">{updated}</text>
      {image_block}
      <text x="64" y="{text_y_start}" font-family="Georgia, serif" font-size="44" font-weight="bold" fill="{fg}">{title[:28]}</text>
      <text x="64" y="{text_y_start + 54}" font-family="sans-serif" font-size="30" fill="{fg}" opacity="0.88">
        {tspan_lines}
      </text>
      <text x="736" y="752" text-anchor="end" font-family="sans-serif" font-size="22" font-weight="bold" fill="#e11d48">🌸 THE US SPACE · 4×4 LIVE</text>
    </svg>"""

    return Response(content=svg, media_type="image/svg+xml", headers={"Cache-Control": "no-cache, no-store, must-revalidate"})