import os
import re
import tempfile
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload, MediaFileUpload

SCOPES = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.force-ssl'
]

def get_credentials():
    creds = Credentials(
        None,
        refresh_token=os.getenv("GOOGLE_REFRESH_TOKEN"),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.getenv("GOOGLE_CLIENT_ID"),
        client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
        scopes=SCOPES
    )
    if not creds.valid:
        creds.refresh(Request())
    return creds

def get_drive_service():
    return build('drive', 'v3', credentials=get_credentials(), cache_discovery=False)

def get_youtube_service():
    return build('youtube', 'v3', credentials=get_credentials(), cache_discovery=False)

def upload_to_drive(file_obj, filename: str, mime_type: str) -> str:
    drive_service = get_drive_service()
    folder_id = os.getenv("GOOGLE_DRIVE_FOLDER_ID")
    
    file_metadata = {'name': filename}
    if folder_id:
        file_metadata['parents'] = [folder_id]

    media = MediaIoBaseUpload(file_obj, mimetype=mime_type, resumable=True)
    uploaded = drive_service.files().create(
        body=file_metadata,
        media_body=media,
        fields='id'
    ).execute()
    
    file_id = uploaded.get('id')
    
    # Ensure file is viewable by link
    try:
        drive_service.permissions().create(
            fileId=file_id,
            body={'type': 'anyone', 'role': 'reader'}
        ).execute()
    except Exception as e:
        print(f"Drive permission warning: {e}")

    if mime_type and mime_type.startswith("video/"):
        return f"video#https://drive.google.com/uc?id={file_id}&export=download"
    if mime_type and mime_type.startswith("audio/"):
        return f"voice#https://drive.google.com/uc?id={file_id}&export=download"
    return f"https://drive.google.com/uc?id={file_id}&export=view"

def upload_to_youtube(file_obj, title: str, description: str = "", mime_type: str = "video/mp4") -> str:
    """
    Uploads video to YouTube as Unlisted. 
    If YouTube API quota or token scope fails, automatically falls back to Google Drive 
    so the user never gets 'Save Failed: Network error occurred.'
    """
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
            file_obj.seek(0)
            while chunk := file_obj.read(1024 * 1024 * 4):
                tmp.write(chunk)
            temp_path = tmp.name

        youtube = get_youtube_service()
        body = {
            'snippet': {
                'title': title[:95] if title else 'Our Memory Video',
                'description': description or 'Uploaded from The Us Space',
                'categoryId': '22'
            },
            'status': {
                'privacyStatus': 'unlisted',
                'selfDeclaredMadeForKids': False
            }
        }

        media = MediaFileUpload(
            temp_path,
            mimetype=mime_type or 'video/mp4',
            chunksize=1024 * 1024 * 5,
            resumable=True
        )
        request = youtube.videos().insert(
            part="snippet,status",
            body=body,
            media_body=media
        )

        response = None
        while response is None:
            _, response = request.next_chunk()

        video_id = response.get('id')
        return f"https://www.youtube.com/watch?v={video_id}"

    except Exception as yt_err:
        print(f"YouTube upload failed ({yt_err}), falling back to Google Drive...")
        file_obj.seek(0)
        return upload_to_drive(file_obj, f"{title or 'video'}.mp4", mime_type or "video/mp4")

    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass

def delete_media_from_cloud(file_url: str) -> bool:
    """
    Task 2: Permanently deletes a media file from YouTube or Google Drive based on its URL.
    """
    if not file_url:
        return False

    clean_url = re.sub(r'^(voice#|video#)', '', file_url)

    # 1. Check if YouTube Video
    yt_match = re.search(r'(?:v=|youtu\.be/|embed/|yt:)([a-zA-Z0-9_-]{11})', clean_url)
    if yt_match and 'drive.google.com' not in clean_url:
        video_id = yt_match.group(1)
        try:
            youtube = get_youtube_service()
            youtube.videos().delete(id=video_id).execute()
            return True
        except Exception as e:
            print(f"Failed to delete YouTube video {video_id}: {e}")
            return False

    # 2. Check if Google Drive File
    drive_match = re.search(r'(?:id=|/d/)([a-zA-Z0-9_-]+)', clean_url)
    if drive_match:
        file_id = drive_match.group(1)
        try:
            drive = get_drive_service()
            drive.files().delete(fileId=file_id).execute()
            return True
        except Exception as e:
            print(f"Failed to delete Drive file {file_id}: {e}")
            return False

    return False

# import os
# import json
# from google.oauth2.credentials import Credentials
# from googleapiclient.discovery import build
# from googleapiclient.http import MediaFileUpload
# from google.auth.transport.requests import Request

# def get_google_credentials(token_prefix, account_index=1):
#     """Loads the pre-authorized user token generated from your laptop."""
#     token_path = f"{token_prefix}_{account_index}.json" if account_index > 1 else f"{token_prefix}.json"
    
#     if not os.path.exists(token_path):
#         if account_index == 1 and os.path.exists(f"{token_prefix}_1.json"):
#             token_path = f"{token_prefix}_1.json"
#         else:
#             return None
            
#     try:
#         creds = Credentials.from_authorized_user_file(token_path)
#         if creds and creds.expired and creds.refresh_token:
#             creds.refresh(Request())
#         return creds
#     except Exception as e:
#         print(f"Auth Error on {token_path}: {e}")
#         return None

# def get_drive_service(account_index=1):
#     creds = get_google_credentials("drive_token", account_index)
#     if not creds: return None
#     try:
#         return build('drive', 'v3', credentials=creds, cache_discovery=False)
#     except Exception:
#         return None
        
# def get_youtube_service(account_index=1):
#     creds = get_google_credentials("youtube_token", account_index)
#     if not creds: return None
#     try:
#         return build('youtube', 'v3', credentials=creds, cache_discovery=False)
#     except Exception:
#         return None

# def upload_to_drive(file_path, mime_type, original_filename):
#     for i in range(1, 10):
#         service = get_drive_service(i)
#         folder_id = os.getenv(f"DRIVE_FOLDER_ID_{i}")
        
#         if not service or not folder_id:
#             continue
            
#         try:
#             file_metadata = {'name': original_filename, 'parents': [folder_id]}
#             media = MediaFileUpload(file_path, mimetype=mime_type, resumable=True)
            
#             file_data = service.files().create(
#                 body=file_metadata, 
#                 media_body=media, 
#                 fields='id, webContentLink, thumbnailLink'
#             ).execute()
            
#             service.permissions().create(
#                 fileId=file_data.get('id'),
#                 body={'type': 'anyone', 'role': 'reader'}
#             ).execute()
            
#             return file_data
#         except Exception as e:
#             print(f"Drive {i} failed: {e}")
#             continue
            
#     raise Exception("All Google Drive accounts are full or missing credentials!")

# def upload_to_youtube(file_path, title, description):
#     for i in range(1, 10):
#         youtube = get_youtube_service(i)
#         if not youtube: continue
            
#         try:
#             body = {
#                 'snippet': {
#                     'title': title,
#                     'description': description,
#                     'categoryId': '22'
#                 },
#                 'status': {
#                     'privacyStatus': 'unlisted'
#                 }
#             }
#             media = MediaFileUpload(file_path, chunksize=-1, resumable=True)
#             request = youtube.videos().insert(part=','.join(body.keys()), body=body, media_body=media)
#             response = request.execute()
#             return response.get('id')
#         except Exception as e:
#             print(f"YouTube account {i} failed: {e}")
#             continue
            
#     raise Exception("All YouTube accounts reached quota or are misconfigured!")

# def delete_from_cloud(file_url_str):
#     try:
#         data = json.loads(file_url_str)
#         provider = data.get("provider")
#         file_id = data.get("id")
        
#         if provider == "drive" and file_id:
#             for i in range(1, 10):
#                 service = get_drive_service(i)
#                 if not service: break
#                 try:
#                     service.files().delete(fileId=file_id).execute()
#                     return
#                 except Exception:
#                     continue
#         elif provider == "youtube" and file_id:
#             for i in range(1, 10):
#                 youtube = get_youtube_service(i)
#                 if not youtube: break
#                 try:
#                     youtube.videos().delete(id=file_id).execute()
#                     return
#                 except Exception:
#                     continue
#     except Exception:
#         pass