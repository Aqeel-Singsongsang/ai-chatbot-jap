from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel
import datetime
import uuid

from database import get_db
from models import User
from security import get_password_hash, verify_password, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES

router = APIRouter()

# Schemas
class UserCreate(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    username: str

@router.post("/register", response_model=Token)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    # Check if user exists
    user_exists = db.query(User).filter(User.username == user_in.username).first()
    if user_exists:
        raise HTTPException(
            status_code=400,
            detail="Username already registered"
        )
    
    # Create user
    user_id = str(uuid.uuid4())
    hashed_pass = get_password_hash(user_in.password)
    new_user = User(
        id=user_id,
        username=user_in.username,
        hashed_password=hashed_pass
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Generate token
    access_token_expires = datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": new_user.id}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer", "username": new_user.username}

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # Authenticate
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    # Generate token
    access_token_expires = datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.id}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer", "username": user.username}
