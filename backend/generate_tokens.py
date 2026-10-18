import os
import json
from google_auth_oauthlib.flow import InstalledAppFlow
from backend.services.google_cloud import find_token_file

DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive"]
YOUTUBE_SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.force-ssl"
]

def regenerate_token(filename: str, scopes: list):
    token_path = find_token_file(filename)
    with open(token_path, "r", encoding="utf-8") as f:
        old_data = json.load(f)

    client_id = old_data.get("client_id")
    client_secret = old_data.get("client_secret")

    if not client_id or not client_secret:
        raise ValueError(f"client_id or client_secret missing inside {token_path}")

    client_config = {
        "installed": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": ["http://localhost"]
        }
    }

    print(f"\n🌐 Opening browser to authenticate {filename}...")
    flow = InstalledAppFlow.from_client_config(client_config, scopes=scopes)
    # access_type='offline' and prompt='consent' guarantee a fresh, permanent refresh_token
    creds = flow.run_local_server(port=0, access_type="offline", prompt="consent")

    with open(token_path, "w", encoding="utf-8") as f:
        f.write(creds.to_json())
    print(f"✅ Successfully saved new permanent token to: {token_path}")

if __name__ == "__main__":
    regenerate_token("drive_token.json", DRIVE_SCOPES)
    regenerate_token("youtube_token.json", YOUTUBE_SCOPES)
    print("\n🎉 Both Drive and YouTube tokens are refreshed and ready!")