import os
import json
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from google.auth.transport.requests import Request

def get_google_credentials(token_prefix, account_index=1):
    """Loads the pre-authorized user token generated from your laptop."""
    token_path = f"{token_prefix}_{account_index}.json" if account_index > 1 else f"{token_prefix}.json"
    
    if not os.path.exists(token_path):
        if account_index == 1 and os.path.exists(f"{token_prefix}_1.json"):
            token_path = f"{token_prefix}_1.json"
        else:
            return None
            
    try:
        creds = Credentials.from_authorized_user_file(token_path)
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        return creds
    except Exception as e:
        print(f"Auth Error on {token_path}: {e}")
        return None

def get_drive_service(account_index=1):
    creds = get_google_credentials("drive_token", account_index)
    if not creds: return None
    try:
        return build('drive', 'v3', credentials=creds, cache_discovery=False)
    except Exception:
        return None
        
def get_youtube_service(account_index=1):
    creds = get_google_credentials("youtube_token", account_index)
    if not creds: return None
    try:
        return build('youtube', 'v3', credentials=creds, cache_discovery=False)
    except Exception:
        return None

def upload_to_drive(file_path, mime_type, original_filename):
    for i in range(1, 10):
        service = get_drive_service(i)
        folder_id = os.getenv(f"DRIVE_FOLDER_ID_{i}")
        
        if not service or not folder_id:
            continue
            
        try:
            file_metadata = {'name': original_filename, 'parents': [folder_id]}
            media = MediaFileUpload(file_path, mimetype=mime_type, resumable=True)
            
            file_data = service.files().create(
                body=file_metadata, 
                media_body=media, 
                fields='id, webContentLink, thumbnailLink'
            ).execute()
            
            service.permissions().create(
                fileId=file_data.get('id'),
                body={'type': 'anyone', 'role': 'reader'}
            ).execute()
            
            return file_data
        except Exception as e:
            print(f"Drive {i} failed: {e}")
            continue
            
    raise Exception("All Google Drive accounts are full or missing credentials!")

def upload_to_youtube(file_path, title, description):
    for i in range(1, 10):
        youtube = get_youtube_service(i)
        if not youtube: continue
            
        try:
            body = {
                'snippet': {
                    'title': title,
                    'description': description,
                    'categoryId': '22'
                },
                'status': {
                    'privacyStatus': 'unlisted'
                }
            }
            media = MediaFileUpload(file_path, chunksize=-1, resumable=True)
            request = youtube.videos().insert(part=','.join(body.keys()), body=body, media_body=media)
            response = request.execute()
            return response.get('id')
        except Exception as e:
            print(f"YouTube account {i} failed: {e}")
            continue
            
    raise Exception("All YouTube accounts reached quota or are misconfigured!")

def delete_from_cloud(file_url_str):
    try:
        data = json.loads(file_url_str)
        provider = data.get("provider")
        file_id = data.get("id")
        
        if provider == "drive" and file_id:
            for i in range(1, 10):
                service = get_drive_service(i)
                if not service: break
                try:
                    service.files().delete(fileId=file_id).execute()
                    return
                except Exception:
                    continue
        elif provider == "youtube" and file_id:
            for i in range(1, 10):
                youtube = get_youtube_service(i)
                if not youtube: break
                try:
                    youtube.videos().delete(id=file_id).execute()
                    return
                except Exception:
                    continue
    except Exception:
        pass