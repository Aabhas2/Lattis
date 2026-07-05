from fastapi import FastAPI 
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings 
from app.api.router import api_router 
from app.db.session import ping_db 
from app.utils.redis_client import ping_redis 

app = FastAPI(title="Lattis API", version="0.1")

#CORS for local dev (Next.js) 
app.add_middleware(
    CORSMiddleware, 
    allow_origins=settings.cors_origins_list, 
    allow_credentials=True, 
    allow_methods=["*"], 
    allow_headers=["*"],
)

app.include_router(api_router)

@app.get("/")
def root(): 
    return {"message": "API is runnign"}

@app.on_event("startup") 
def startup_checks(): 
    # These checks prove our dependencies are reachable. 
    ping_db() 
    ping_redis() 
