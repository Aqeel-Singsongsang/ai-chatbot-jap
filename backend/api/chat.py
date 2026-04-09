from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Optional
import datetime
import uuid

from services.groq_service import groq_service
from database import get_db
from models import Message, Conversation, User
from security import get_current_user_optional

router = APIRouter()

@router.post("/chat")
async def chat_interaction(
    audio: Optional[UploadFile] = File(default=None),
    text: Optional[str] = Form(default=None),
    personality: str = Form(default="ramah"),
    translation_lang: str = Form(default="indonesia"),
    conversation_id: str = Form(...),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    try:
        # Verify ownership
        query = db.query(Conversation).filter(Conversation.id == conversation_id)
        if current_user:
            query = query.filter(Conversation.user_id == current_user.id)
        else:
            query = query.filter(Conversation.user_id == None)
            
        conv = query.first()
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found or unauthorized")
        
        user_text = ""
        
        # Extract learning mode state before transcription
        learning_mode = conv.learning_mode if conv else False
        
        if audio and audio.filename:
            # Read the uploaded audio bytes
            audio_bytes = await audio.read()
            filename = audio.filename
            # 1. Speech to Text (Whisper)
            user_text = groq_service.transcribe_audio(audio_bytes, filename, learning_mode)
        elif text:
            # Use direct text input
            user_text = text.strip()
        else:
            raise HTTPException(status_code=400, detail="Harus mengirimkan file audio atau input string text.")
            
        if not user_text or user_text.strip() == "":
            raise HTTPException(status_code=400, detail="Teks pengguna kosong.")
            
        # Fetch history from DB
        history_records = db.query(Message).filter(Message.conversation_id == conversation_id).order_by(Message.created_at.asc()).all()
        history_list = [{"sender": msg.sender, "text": msg.text} for msg in history_records]
            
        # 2. Generate Reply using LLM (Llama 3.3)
        ai_reply_text = groq_service.generate_chat_reply(user_text, personality, translation_lang, history_list, learning_mode)
        
        # Save messages to DB
        user_msg = Message(
            id=str(uuid.uuid4())[:12], 
            conversation_id=conversation_id, 
            sender="user", 
            text=user_text, 
            created_at=datetime.datetime.utcnow()
        )
        ai_msg = Message(
            id=str(uuid.uuid4())[:12], 
            conversation_id=conversation_id, 
            sender="ai", 
            text=ai_reply_text, 
            created_at=datetime.datetime.utcnow()
        )
        
        db.add(user_msg)
        db.add(ai_msg)
        db.commit()
        db.refresh(user_msg)
        db.refresh(ai_msg)
        
        # 3. Generate Speech using TTS (Disabled)
        ai_audio_base64 = None
        
        return {
            "success": True,
            "user_text": user_text,
            "ai_text": ai_reply_text,
            "ai_audio_base64": ai_audio_base64,
            "audio_format": "audio/wav",
            "message_ids": {"user_id": user_msg.id, "ai_id": ai_msg.id}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
