from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
import datetime
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=True)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    conversations = relationship("Conversation", back_populates="owner", cascade="all, delete-orphan")

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    title = Column(String, default="New Chat")
    personality = Column(String, default="ramah")
    translation_lang = Column(String, default="indonesia")
    learning_mode = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    owner = relationship("User", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan", order_by="Message.created_at")

class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, index=True)
    conversation_id = Column(String, ForeignKey("conversations.id"))
    sender = Column(String, nullable=False) # 'user' or 'ai'
    text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    conversation = relationship("Conversation", back_populates="messages")
