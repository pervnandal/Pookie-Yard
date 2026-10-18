import gc
import io
import os
import re
import time
import shutil
import tempfile
import threading
import requests
from requests.adapters import HTTPAdapter
from dotenv import load_dotenv
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload, MediaFileUpload

load_dotenv()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT_DIR = os.path.dirname(BASE_DIR)
DISK_CACHE_DIR = os.path.join(BASE_DIR, ".media_cache")
os.makedirs(DISK_CACHE_DIR, exist_ok=True)

# Persistent HTTP connection pool for fast Google Drive API calls
_http_session = requests.Session()
_adapter = HTTPAdapter(pool_connections=32, pool_maxsize=32, max_retries=2)
_http_session.mount("https://", _adapter)
_http_session.mount("http://", _adapter)

_creds_lock = threading.Lock()
_cached_creds = {}

# Lightweight RAM cache ONLY for small thumbnails (< 300KB each)
_ram_cache = {}
MAX_RAM_CACHE_ITEMS = 80


def find_token_file(filename: str) -> str:
    candidate_paths = [
        os.path.join(BASE_DIR, "secrets", filename),
        os.path.join(BASE_DIR, filename),
        os.path.join(ROOT_DIR, "secrets", filename),
        os.path.join(ROOT_DIR, filename),
        os.path.join("/etc/secrets", filename),
        filename
    ]
    for path in candidate_paths:
        if os.path.isfile(path):
            return path

    for root, _, files in os.walk(BASE_DIR):
        if filename in files:
            return os.path.join(root, filename)

    raise FileNotFoundError(f"Could not find '{filename}' in backend/ or secrets/ folder.")


def load_credentials(token_filename: str) -> Credentials:
    with _creds_lock:
        creds = _cached_creds.get(token_filename)
        if creds is None:
            token_path = find_token_file(token_filename)
            creds = Credentials.from_authorized_user_file(token_path)
            _cached_creds[token_filename] = creds

        if not creds.valid and creds.expired and creds.refresh_token:
            creds.refresh(Request())
            try:
                token_path = find_token_file(token_filename)
                with open(token_path, "w", encoding="utf-8") as f:
                    f.write(creds.to_json())
            except Exception:
                pass
        return creds


def get_drive_auth_headers() -> dict:
    creds = load_credentials("drive_token.json")
    return {"Authorization": f"Bearer {creds.token}"}


def get_drive_service():
    creds = load_credentials("drive_token.json")
    return build("drive", "v3", credentials=creds, cache_discovery=False)


def get_youtube_service():
    try:
        creds = load_credentials("youtube_token.json")
    except FileNotFoundError:
        creds = load_credentials("drive_token.json")
    return build("youtube", "v3", credentials=creds, cache_discovery=False)


def get_drive_folder_id() -> str:
    return (
        os.getenv("DRIVE_FOLDER_ID_1")
        or os.getenv("DRIVE_FOLDER_ID_2")
        or os.getenv("DRIVE_FOLDER_ID")
        or os.getenv("GOOGLE_DRIVE_FOLDER_ID")
        or ""
    ).strip("'\" ")


def _disk_cache_path(file_id: str, size: str) -> str:
    safe_id = re.sub(r"[^a-zA-Z0-9_-]", "", file_id)
    return os.path.join(DISK_CACHE_DIR, f"{safe_id}_{size}.bin")


def _meta_cache_path(file_id: str) -> str:
    safe_id = re.sub(r"[^a-zA-Z0-9_-]", "", file_id)
    return os.path.join(DISK_CACHE_DIR, f"{safe_id}.meta")


def _save_to_caches(file_id: str, size: str, data: bytes, mime_type: str, filename: str):
    cache_key = f"{file_id}:{size}"
    # Only keep small thumbnails in RAM so Render never runs out of memory
    if size == "thumb" and len(data) < 350 * 1024:
        if len(_ram_cache) >= MAX_RAM_CACHE_ITEMS:
            _ram_cache.pop(next(iter(_ram_cache)), None)
        _ram_cache[cache_key] = (data, mime_type, filename)

    # Save thumb and preview to disk cache
    if size in ("thumb", "preview") and len(data) < 5 * 1024 * 1024:
        try:
            with open(_disk_cache_path(file_id, size), "wb") as f:
                f.write(data)
            with open(_meta_cache_path(file_id), "w", encoding="utf-8") as f:
                f.write(f"{mime_type}\n{filename}")
        except Exception:
            pass


def _read_from_caches(file_id: str, size: str):
    cache_key = f"{file_id}:{size}"
    if cache_key in _ram_cache:
        return _ram_cache[cache_key]

    bin_path = _disk_cache_path(file_id, size)
    if os.path.isfile(bin_path):
        try:
            with open(bin_path, "rb") as f:
                data = f.read()
            mime_type = "image/jpeg"
            filename = f"memory_{file_id}"
            meta_path = _meta_cache_path(file_id)
            if os.path.isfile(meta_path):
                with open(meta_path, "r", encoding="utf-8") as mf:
                    lines = mf.read().splitlines()
                    if len(lines) >= 2:
                        mime_type, filename = lines[0], lines[1]
            if size == "thumb" and len(data) < 350 * 1024:
                _ram_cache[cache_key] = (data, mime_type, filename)
            return data, mime_type, filename
        except Exception:
            pass
    return None


def upload_raw_to_drive(file_obj, filename: str, mime_type: str, drive_service=None) -> str:
    """Streams file_obj directly to Google Drive in chunks without loading the full file into RAM."""
    if drive_service is None:
        drive_service = get_drive_service()
    folder_id = get_drive_folder_id()

    file_metadata = {"name": filename}
    if folder_id:
        file_metadata["parents"] = [folder_id]

    try:
        file_obj.seek(0)
    except Exception:
        pass

    media = MediaIoBaseUpload(
        file_obj,
        mimetype=mime_type or "application/octet-stream",
        chunksize=1024 * 1024 * 4,
        resumable=True
    )
    request = drive_service.files().create(
        body=file_metadata,
        media_body=media,
        fields="id"
    )

    response = None
    while response is None:
        _, response = request.next_chunk()

    file_id = response.get("id")

    try:
        drive_service.permissions().create(
            fileId=file_id,
            body={"type": "anyone", "role": "reader"}
        ).execute()
    except Exception:
        pass

    return file_id


def upload_to_drive(file_obj, filename: str, mime_type: str, drive_service=None) -> str:
    file_id = upload_raw_to_drive(file_obj, filename, mime_type, drive_service=drive_service)

    if mime_type and mime_type.startswith("video/"):
        return f"video#https://drive.google.com/uc?id={file_id}&export=download"
    if mime_type and mime_type.startswith("audio/"):
        return f"voice#https://drive.google.com/uc?id={file_id}&export=download"
    return f"https://drive.google.com/uc?id={file_id}&export=view"


def upload_to_youtube(file_obj, title: str, description: str = "", mime_type: str = "video/mp4") -> str:
    drive_file_id = None
    try:
        file_obj.seek(0)
        drive_file_id = upload_raw_to_drive(file_obj, f"{title or 'video'}.mp4", mime_type or "video/mp4")
    except Exception as drive_err:
        print(f"Drive backup note for video: {drive_err}")

    temp_path = None
    try:
        suffix = ".mp4"
        if mime_type and "/" in mime_type:
            ext = mime_type.split("/")[-1].split(";")[0].strip()
            if ext in ("mp4", "mov", "webm", "mkv", "avi"):
                suffix = f".{ext}"

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            file_obj.seek(0)
            shutil.copyfileobj(file_obj, tmp, length=1024 * 1024 * 4)
            temp_path = tmp.name

        youtube = get_youtube_service()
        body = {
            "snippet": {
                "title": (title or "Our Memory Video")[:95],
                "description": description or "Uploaded from The Us Space",
                "categoryId": "22"
            },
            "status": {
                "privacyStatus": "unlisted",
                "selfDeclaredMadeForKids": False
            }
        }

        media = MediaFileUpload(
            temp_path,
            mimetype=mime_type or "video/mp4",
            chunksize=1024 * 1024 * 4,
            resumable=True
        )
        request = youtube.videos().insert(part="snippet,status", body=body, media_body=media)

        response = None
        while response is None:
            _, response = request.next_chunk()

        video_id = response.get("id")
        if drive_file_id:
            return f"https://www.youtube.com/watch?v={video_id}&drive_id={drive_file_id}"
        return f"https://www.youtube.com/watch?v={video_id}"

    except Exception as yt_err:
        print(f"YouTube upload skipped/failed ({yt_err}), using Google Drive video...")
        if drive_file_id:
            return f"video#https://drive.google.com/uc?id={drive_file_id}&export=download"
        file_obj.seek(0)
        return upload_to_drive(file_obj, f"{title or 'video'}.mp4", mime_type or "video/mp4")

    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass
        gc.collect()


def fetch_drive_file_bytes(file_id: str, size: str = "original"):
    """
    Uses Google Drive's cloud thumbnail generator (=s400 for thumb, =s1400 for preview)
    so Render never decodes 108MP images in local RAM.
    """
    if size not in ("thumb", "preview", "original"):
        size = "original"

    if size in ("thumb", "preview"):
        cached = _read_from_caches(file_id, size)
        if cached:
            return cached[0], cached[2], cached[1]

    headers = get_drive_auth_headers()
    meta_url = f"https://www.googleapis.com/drive/v3/files/{file_id}?fields=name,mimeType,thumbnailLink"
    meta_res = _http_session.get(meta_url, headers=headers, timeout=10)
    if meta_res.status_code != 200:
        raise FileNotFoundError(f"Drive file {file_id} not accessible ({meta_res.status_code})")

    meta = meta_res.json()
    filename = meta.get("name") or f"memory_{file_id}"
    mime_type = meta.get("mimeType") or "image/jpeg"
    thumb_link = meta.get("thumbnailLink")

    # If requesting thumb/preview and Drive is still indexing a brand-new upload, retry once after 0.6s
    if size in ("thumb", "preview") and mime_type.startswith("image/") and not thumb_link:
        time.sleep(0.6)
        meta_res2 = _http_session.get(meta_url, headers=headers, timeout=10)
        if meta_res2.status_code == 200:
            thumb_link = meta_res2.json().get("thumbnailLink")

    if size in ("thumb", "preview") and mime_type.startswith("image/") and thumb_link:
        target_px = "=s400" if size == "thumb" else "=s1400"
        fast_url = re.sub(r"=s\d+", target_px, thumb_link)
        t_res = _http_session.get(fast_url, headers=headers, timeout=12)
        if t_res.status_code == 200 and t_res.content:
            t_mime = t_res.headers.get("Content-Type", "image/jpeg")
            _save_to_caches(file_id, size, t_res.content, t_mime, filename)
            return t_res.content, filename, t_mime

    # Fallback / Original download
    dl_url = f"https://www.googleapis.com/drive/v3/files/{file_id}?alt=media"
    dl_res = _http_session.get(dl_url, headers=headers, timeout=45)
    if dl_res.status_code != 200:
        raise RuntimeError(f"Failed to download Drive file {file_id}")

    return dl_res.content, filename, mime_type


def download_original_from_drive(file_url: str):
    if not file_url:
        return None, None, None

    drive_id_match = (
        re.search(r"drive_id=([a-zA-Z0-9_-]+)", file_url)
        or re.search(r"drive-image/([a-zA-Z0-9_-]+)", file_url)
        or re.search(r"(?:id=|/d/)([a-zA-Z0-9_-]+)", file_url)
    )
    if not drive_id_match:
        return None, None, None

    file_id = drive_id_match.group(1)
    raw_bytes, filename, mime_type = fetch_drive_file_bytes(file_id, size="original")
    return io.BytesIO(raw_bytes), filename, mime_type


def delete_media_from_cloud(file_url: str) -> bool:
    if not file_url:
        return False

    clean_url = re.sub(r"^(voice#|video#)", "", file_url)
    deleted_any = False

    yt_match = re.search(r"(?:v=|youtu\.be/|embed/|yt:)([a-zA-Z0-9_-]{11})", clean_url)
    if yt_match and "drive.google.com" not in clean_url.split("&drive_id=")[0]:
        video_id = yt_match.group(1)
        try:
            youtube = get_youtube_service()
            youtube.videos().delete(id=video_id).execute()
            deleted_any = True
        except Exception as e:
            print(f"YouTube delete warning ({video_id}): {e}")

    drive_ids = set()
    for pattern in [r"drive_id=([a-zA-Z0-9_-]+)", r"drive-image/([a-zA-Z0-9_-]+)", r"(?:id=|/d/)([a-zA-Z0-9_-]+)"]:
        m = re.search(pattern, clean_url)
        if m:
            drive_ids.add(m.group(1))

    for file_id in drive_ids:
        for sz in ("thumb", "preview", "original"):
            _ram_cache.pop(f"{file_id}:{sz}", None)
            try:
                p = _disk_cache_path(file_id, sz)
                if os.path.exists(p):
                    os.remove(p)
            except Exception:
                pass
        try:
            drive = get_drive_service()
            drive.files().delete(fileId=file_id).execute()
            deleted_any = True
        except Exception as e:
            print(f"Drive delete warning ({file_id}): {e}")

    return deleted_any