from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import datetime
import uuid

from database import get_db
from models import Conversation, Message, User
from security import get_current_user, get_current_user_optional

router = APIRouter()

# Pydantic Schemas
class MessageBase(BaseModel):
    id: str
    sender: str
    text: str

    class Config:
        orm_mode = True

class ConversationBase(BaseModel):
    id: str
    title: str
    personality: str
    translation_lang: str
    learning_mode: bool
    messages: List[MessageBase] = []

    class Config:
        orm_mode = True

class ConversationUpdate(BaseModel):
    title: Optional[str] = None
    personality: Optional[str] = None
    translation_lang: Optional[str] = None
    learning_mode: Optional[bool] = None

@router.get("/conversations", response_model=List[ConversationBase])
def get_conversations(db: Session = Depends(get_db), current_user: Optional[User] = Depends(get_current_user_optional)):
    if not current_user:
        return []
    conversations = db.query(Conversation).filter(Conversation.user_id == current_user.id).order_by(Conversation.created_at.desc()).all()
    return conversations

@router.post("/conversations", response_model=ConversationBase)
def create_conversation(db: Session = Depends(get_db), current_user: Optional[User] = Depends(get_current_user_optional)):
    conv_id = str(uuid.uuid4())[:8]
    db_conv = Conversation(
        id=conv_id,
        user_id=current_user.id if current_user else None,
        title="New Chat",
        personality="ramah",
        translation_lang="indonesia",
        learning_mode=False
    )
    db.add(db_conv)
    db.commit()
    db.refresh(db_conv)
    return db_conv

@router.delete("/conversations/{conv_id}")
def delete_conversation(conv_id: str, db: Session = Depends(get_db), current_user: Optional[User] = Depends(get_current_user_optional)):
    # If not logged in, any Guest can technically delete anonymous sessions if they have the ID, though in a real app we'd scope this by device ID
    query = db.query(Conversation).filter(Conversation.id == conv_id)
    if current_user:
        query = query.filter(Conversation.user_id == current_user.id)
    else:
        query = query.filter(Conversation.user_id == None)
        
    db_conv = query.first()
    if not db_conv:
        raise HTTPException(status_code=404, detail="Conversation not found or unauthorized")
    
    db.delete(db_conv)
    db.commit()
    return {"success": True}

@router.patch("/conversations/{conv_id}")
def update_conversation(conv_id: str, payload: ConversationUpdate, db: Session = Depends(get_db), current_user: Optional[User] = Depends(get_current_user_optional)):
    query = db.query(Conversation).filter(Conversation.id == conv_id)
    if current_user:
        query = query.filter(Conversation.user_id == current_user.id)
    else:
        query = query.filter(Conversation.user_id == None)
        
    db_conv = query.first()
    if not db_conv:
        raise HTTPException(status_code=404, detail="Conversation not found or unauthorized")
    
    if payload.title is not None:
        db_conv.title = payload.title
    if payload.personality is not None:
        db_conv.personality = payload.personality
    if payload.translation_lang is not None:
        db_conv.translation_lang = payload.translation_lang
    if payload.learning_mode is not None:
        db_conv.learning_mode = payload.learning_mode
        
    db.commit()
    db.refresh(db_conv)
    return db_conv
