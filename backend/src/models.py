from sqlalchemy import Column, String, Text, DateTime, Integer, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid
from src.database import Base

class Deck(Base):
    __tablename__ = "decks"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=True)
    user_id = Column(UUID(as_uuid=True), nullable=False) 
    source_text = Column(Text, nullable=True)
    difficulty = Column(String, default="medium")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationship to flashcards
    flashcards = relationship("Flashcard", back_populates="deck", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Deck {self.id}: {self.title}>"

class Flashcard(Base):
    __tablename__ = "flashcards"
    
    id = Column(Integer, primary_key=True)
    deck_id = Column(UUID(as_uuid=True), ForeignKey("decks.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), nullable=False) 
    front = Column(Text, nullable=False)
    back = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    
    # Relationship to deck
    deck = relationship("Deck", back_populates="flashcards")
    
    def __repr__(self):
        return f"<Flashcard {self.id}: {self.front}>"

class Word(Base):
    __tablename__ = "words"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    word = Column(String, nullable=False)
    definition = Column(Text, nullable=False)
    example = Column(Text, nullable=True)
    pronunciation = Column(String, nullable=True)
    status = Column(String, default="pending")  # pending, approved, rejected
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<Word {self.id}: {self.word}>"

class PracticeSession(Base):
    __tablename__ = "practice_sessions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    deck_id = Column(UUID(as_uuid=True), ForeignKey("decks.id", ondelete="SET NULL"), nullable=True)
    practice_type = Column(String, nullable=False, default="flashcard")  # "flashcard" or "conversation"
    duration_seconds = Column(Integer, nullable=False)  # Total practice time in seconds
    completed_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    
    # Relationship to deck
    deck = relationship("Deck")
    
    def __repr__(self):
        return f"<PracticeSession {self.id}: {self.practice_type} {self.duration_seconds}s>"

class UserSetting(Base):
    __tablename__ = "user_settings"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, unique=True)
    daily_goal_minutes = Column(Integer, default=15, nullable=False)  # Default 15 minutes
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<UserSetting {self.id}: {self.daily_goal_minutes}min/day>"