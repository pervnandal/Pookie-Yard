import os
from dotenv import load_dotenv
from supabase import create_client, Client
from groq import Groq

load_dotenv()

# App Credentials
APP_USERNAME = os.getenv("APP_USERNAME", "us")
APP_PASSWORD = os.getenv("APP_PASSWORD", "forever")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# External Clients
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None
groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None