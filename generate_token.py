import os
from google_auth_oauthlib.flow import InstalledAppFlow

def get_token(scopes, output_file):
    print(f"\n--- Authorizing {output_file} ---")
    # Initialize the OAuth flow for the specific scope
    flow = InstalledAppFlow.from_client_secrets_file('youtube_client_1.json', scopes)
    creds = flow.run_local_server(port=0)
    
    # Save the token
    with open(output_file, 'w') as token:
        token.write(creds.to_json())
    print(f"✅ Created {output_file} successfully!")

def main():
    if not os.path.exists('youtube_client_1.json'):
        print("❌ ERROR: Could not find 'youtube_client_1.json'.")
        return
        
    print("Google requires Drive and YouTube to be authorized separately.")
    
    # Step 1: Authorize Google Drive
    print("\n[STEP 1]: Authorizing Google Drive (For Photos & Audio)")
    get_token(['https://www.googleapis.com/auth/drive.file'], 'drive_token.json')
    
    # Step 2: Authorize YouTube
    print("\n[STEP 2]: Authorizing YouTube (For Videos)")
    get_token(['https://www.googleapis.com/auth/youtube.upload'], 'youtube_token.json')
    
    print("\n🎉 All done! You now have both tokens ready for your server.")

if __name__ == '__main__':
    main()