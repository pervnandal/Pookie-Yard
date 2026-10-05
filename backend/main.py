from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import all routers
from backend.routers.auth import router as auth_router
from backend.routers.memories import router as memories_router
from backend.routers.planner import router as planner_router
from backend.routers.ai import router as ai_router
from backend.routers.websockets import router as ws_router

app = FastAPI(title="The Us Space API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Routers cleanly
app.include_router(auth_router)
app.include_router(memories_router)
app.include_router(planner_router)
app.include_router(ai_router)
app.include_router(ws_router)

@app.get("/")
def read_root():
    return {"message": "The Us Space API is running modularly and perfectly."}