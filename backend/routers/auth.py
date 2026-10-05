from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from backend.config import APP_USERNAME, APP_PASSWORD

router = APIRouter(prefix="/api")

class LoginRequest(BaseModel):
    username: str
    password: str

@router.post("/login")
def login(req: LoginRequest):
    if req.username == APP_USERNAME and req.password == APP_PASSWORD:
        return {"success": True}
    raise HTTPException(status_code=401, detail="Invalid credentials.")