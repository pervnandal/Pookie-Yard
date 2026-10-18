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

try:
    import yt_dlp
    HAS_YTDLP = True
except ImportError:
    HAS_YTDLP = False

load_dotenv()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT_DIR = os.path.dirname(BASE_DIR)
DISK_CACHE_DIR = os.path.join(BASE_DIR, ".media_cache")
os.makedirs(DISK_CACHE_DIR, exist_ok=True)

_http_session = requests.Session()
_adapter = HTTPAdapter(pool_connections=32, pool_maxsize=32, max_retries=2)
_http_session.mount("https://", _adapter)
_http_session.mount("http://", _adapter)

_creds_lock = threading.Lock()
_cached_creds = {}

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
    if size == "thumb" and len(data) < 350 * 1024:
        if len(_ram_cache) >= MAX_RAM_CACHE_ITEMS:
            _ram_cache.pop(next(iter(_ram_cache)), None)
        _ram_cache[cache_key] = (data, mime_type, filename)

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
    """Streams photos and voice notes directly to Google Drive."""
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
        fields="id",
        supportsAllDrives=True
    )

    response = None
    while response is None:
        _, response = request.next_chunk()

    file_id = response.get("id")

    try:
        drive_service.permissions().create(
            fileId=file_id,
            body={"type": "anyone", "role": "reader"},
            supportsAllDrives=True
        ).execute()
    except Exception:
        pass

    return file_id


def upload_to_drive(file_obj, filename: str, mime_type: str, drive_service=None) -> str:
    file_id = upload_raw_to_drive(file_obj, filename, mime_type, drive_service=drive_service)

    if mime_type and mime_type.startswith("audio/"):
        return f"voice#https://drive.google.com/uc?id={file_id}&export=download"
    return f"https://drive.google.com/uc?id={file_id}&export=view"


def upload_to_youtube(file_obj, title: str, description: str = "", mime_type: str = "video/mp4") -> str:
    """
    Uploads videos EXCLUSIVELY to YouTube (does NOT save videos to Google Drive).
    """
    temp_path = None
    try:
        suffix = ".mp4"
        if mime_type and "/" in mime_type:
            ext = mime_type.split("/")[-1].split(";")[0].strip()
            if ext in ("mp4", "mov", "webm", "mkv", "avi"):
                suffix = f".{ext}"

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            try:
                file_obj.seek(0)
            except Exception:
                pass
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
        return f"https://www.youtube.com/watch?v={video_id}"

    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass
        gc.collect()


def download_youtube_video_bytes(file_url: str):
    """
    Downloads a YouTube video (including unlisted videos) in high quality MP4
    so both Single Downloads and Album ZIP downloads include your videos.
    """
    if not file_url or not HAS_YTDLP:
        return None, None, None

    yt_match = re.search(r"(?:v=|youtu\.be/|embed/|shorts/|yt:)([a-zA-Z0-9_-]{11})", file_url)
    if not yt_match:
        return None, None, None

    video_id = yt_match.group(1)
    watch_url = f"https://www.youtube.com/watch?v={video_id}"
    temp_dir = tempfile.mkdtemp(prefix="yt_dl_")

    try:
        out_tmpl = os.path.join(temp_dir, "%(title).60s_%(id)s.%(ext)s")
        ydl_opts = {
            "format": "best[ext=mp4]/best",
            "outtmpl": out_tmpl,
            "quiet": True,
            "no_warnings": True,
            "noplaylist": True,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([watch_url])

        downloaded_files = os.listdir(temp_dir)
        if not downloaded_files:
            return None, None, None

        file_path = os.path.join(temp_dir, downloaded_files[0])
        filename = downloaded_files[0]
        with open(file_path, "rb") as f:
            raw_bytes = f.read()

        return io.BytesIO(raw_bytes), filename, "video/mp4"
    except Exception as e:
        print(f"YouTube download warning for {video_id}: {e}")
        return None, None, None
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def fetch_drive_file_bytes(file_id: str, size: str = "original"):
    if size not in ("thumb", "preview", "original"):
        size = "original"

    if size in ("thumb", "preview"):
        cached = _read_from_caches(file_id, size)
        if cached:
            return cached[0], cached[2], cached[1]

    headers = get_drive_auth_headers()
    meta_url = f"https://www.googleapis.com/drive/v3/files/{file_id}?fields=name,mimeType,thumbnailLink&supportsAllDrives=true"
    meta_res = _http_session.get(meta_url, headers=headers, timeout=10)
    if meta_res.status_code != 200:
        raise FileNotFoundError(f"Drive file {file_id} not accessible ({meta_res.status_code})")

    meta = meta_res.json()
    filename = meta.get("name") or f"memory_{file_id}"
    mime_type = meta.get("mimeType") or "image/jpeg"
    thumb_link = meta.get("thumbnailLink")

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

    dl_url = f"https://www.googleapis.com/drive/v3/files/{file_id}?alt=media&supportsAllDrives=true"
    dl_res = _http_session.get(dl_url, headers=headers, timeout=45)
    if dl_res.status_code != 200:
        raise RuntimeError(f"Failed to download Drive file {file_id}")

    return dl_res.content, filename, mime_type


def download_original_from_drive(file_url: str):
    if not file_url:
        return None, None, None

    # 1. If it's a YouTube video URL, download from YouTube first
    if "youtube.com" in file_url or "youtu.be" in file_url:
        yt_buf, yt_name, yt_mime = download_youtube_video_bytes(file_url)
        if yt_buf:
            return yt_buf, yt_name, yt_mime

    # 2. Otherwise (or if yt-dlp isn't installed), try Google Drive ID if present
    drive_id_match = (
        re.search(r"drive_id=([a-zA-Z0-9_-]+)", file_url)
        or re.search(r"drive-image/([a-zA-Z0-9_-]+)", file_url)
        or re.search(r"(?:[?&]id=|/d/)([a-zA-Z0-9_-]+)", file_url)
    )
    if drive_id_match:
        file_id = drive_id_match.group(1)
        try:
            raw_bytes, filename, mime_type = fetch_drive_file_bytes(file_id, size="original")
            return io.BytesIO(raw_bytes), filename, mime_type
        except Exception as e:
            print(f"Drive download skipped for {file_id} ({e}), checking YouTube fallback...")
            if "youtube.com" in file_url or "youtu.be" in file_url:
                return download_youtube_video_bytes(file_url)

    return None, None, None


def delete_media_from_cloud(file_url: str) -> bool:
    """
    Permanently deletes media from Google Drive and/or YouTube.
    """
    if not file_url:
        return False

    clean_url = re.sub(r"^(voice#|video#)", "", file_url).strip()
    deleted_any = False

    # 1. Check and Delete from YouTube
    yt_match = re.search(r"(?:[?&]v=|youtu\.be/|embed/|shorts/|yt:)([a-zA-Z0-9_-]{11})", clean_url)
    if yt_match and "drive.google.com" not in clean_url.split("&drive_id=")[0]:
        video_id = yt_match.group(1)
        try:
            youtube = get_youtube_service()
            youtube.videos().delete(id=video_id).execute()
            print(f"✅ Deleted YouTube video: {video_id}")
            deleted_any = True
        except Exception as e:
            print(f"⚠️ YouTube delete error for {video_id}: {e}")

    # 2. Check and Delete from Google Drive
    drive_ids = set()
    for pattern in [
        r"drive_id=([a-zA-Z0-9_-]+)",
        r"drive-image/([a-zA-Z0-9_-]+)",
        r"[?&]id=([a-zA-Z0-9_-]+)",
        r"/file/d/([a-zA-Z0-9_-]+)",
        r"/d/([a-zA-Z0-9_-]+)"
    ]:
        for m in re.finditer(pattern, clean_url):
            fid = m.group(1)
            if fid and len(fid) >= 15:
                drive_ids.add(fid)

    if drive_ids:
        try:
            drive = get_drive_service()
            for file_id in drive_ids:
                # Clear local caches first
                for sz in ("thumb", "preview", "original"):
                    _ram_cache.pop(f"{file_id}:{sz}", None)
                    try:
                        p = _disk_cache_path(file_id, sz)
                        if os.path.exists(p):
                            os.remove(p)
                    except Exception:
                        pass
                try:
                    meta_p = _meta_cache_path(file_id)
                    if os.path.exists(meta_p):
                        os.remove(meta_p)
                except Exception:
                    pass

                # Permanently delete from Google Drive (fallback to moving to Trash if restricted)
                try:
                    drive.files().delete(fileId=file_id, supportsAllDrives=True).execute()
                    print(f"✅ Permanently deleted Drive file: {file_id}")
                    deleted_any = True
                except Exception as del_err:
                    print(f"Direct Drive delete note for {file_id} ({del_err}), moving to trash...")
                    try:
                        drive.files().update(
                            fileId=file_id,
                            body={"trashed": True},
                            supportsAllDrives=True
                        ).execute()
                        print(f"✅ Moved Drive file to trash: {file_id}")
                        deleted_any = True
                    except Exception as trash_err:
                        print(f"⚠️ Could not delete/trash Drive file {file_id}: {trash_err}")
        except Exception as e:
            print(f"⚠️ Drive service initialization error during delete: {e}")

    return deleted_any