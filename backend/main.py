import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load env variables from .env
load_dotenv()

from api import chat, conversations, auth
from database import engine, Base

import models

app = FastAPI(title="Japanese Learning AI Chatbot", version="1.0.0")

@app.on_event("startup")
def on_startup():
    print("Menciptakan semua tabel database jika belum ada...")
    models.Base.metadata.create_all(bind=engine)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for development, update this for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(chat.router, prefix="/api", tags=["Chat"])
app.include_router(conversations.router, prefix="/api", tags=["Conversations"])

@app.get("/")
def read_root():
    return {"message": "Welcome to Japanese Learning AI Chatbot Backend"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
