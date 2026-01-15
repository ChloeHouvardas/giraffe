from typing import Union, Optional
from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from anthropic import Anthropic
import os
from dotenv import load_dotenv
import json

load_dotenv()

import re
import uuid

# TODO should seperate endpoints
# Import database stuff
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from src.database import get_db
from src.models import Deck, Flashcard, Word

app = FastAPI()

print("="*80)
print("DATABASE URL CHECK:")
database_url = os.getenv("DATABASE_URL")
if database_url:
    print(f"✅ DATABASE_URL found: {database_url[:5]}...")
else:
    print("❌ DATABASE_URL not found!")
print("="*80)

print("="*80)
print("ENVIRONMENT VARIABLES CHECK:")
api_key = os.getenv("ANTHROPIC_API_KEY")
if api_key:
    print(f"✅ ANTHROPIC_API_KEY found: {api_key[:20]}...")
    print(f"   Length: {len(api_key)} characters")
    print(f"   Starts with: {api_key[:10]}")
else:
    print("❌ ANTHROPIC_API_KEY not found in environment!")
print("="*80)

@app.get("/")
def read_root():
    return {"Hello": "World"}

from sqlalchemy import text

@app.get("/api/test-db")
async def test_db(db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(text("SELECT 1"))
        return {"status": "✅ Database connected!", "result": result.scalar()}
    except Exception as e:
        return {"status": "❌ Database connection failed", "error": str(e)}

@app.get("/items/{item_id}")
def read_item(item_id:int, q: Union[str, None] = None):
    return {"item_id": item_id, "q": q}

# CORS
app.add_middleware(
    CORSMiddleware, 
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]

)

class TextInput(BaseModel):
    text: str = Field(..., min_length=1, max_length=10000)
    difficulty: str = Field(default="medium", pattern="^(easy|medium|hard)$")
    user_id: str 

class FlashcardResponse(BaseModel):
    deck_id: str              # ← Added
    flashcards: list[dict]
    count: int
    difficulty: str           # ← Added
    processing_time: float

@app.post("/api/generate-flashcards", response_model=FlashcardResponse)
async def generate_flashcards(
    input_data: TextInput,
    db: AsyncSession = Depends(get_db)  # Add database dependency
):
    """Generate flashcards from text using AI and save to database"""
    print(f"\n{'='*80}")
    print(f"📝 Generating flashcards:")
    print(f"   Text: {input_data.text[:100]}...")
    print(f"   Difficulty: {input_data.difficulty}")
    print(f"   User ID: {input_data.user_id}") 
    
    try:
        # Generate flashcards with AI (your existing code)
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")
        
        client = Anthropic(api_key=api_key)
        
        print(f"🤖 Calling Claude API...")
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            messages=[{
                "role": "user",
                "content": f"""
                Extract vocabulary words and create flashcards.
                
                STRICT RULES:
                1. Front: ONE word (e.g., "chien")
                2. Back: ONE word translation (e.g., "dog")
                3. NO phrases - ONLY single words
                4. Return ONLY valid JSON array, no markdown
                
                Example: [{{"front": "chien", "back": "dog"}}]
                
                Difficulty: {input_data.difficulty}
                Text: {input_data.text}
                """
            }]
        )
        
        ai_response = message.content[0].text
        print(f"📥 AI Response received")
        
        # Parse flashcards (your existing parse_flashcards function)
        flashcards_data = parse_flashcards(ai_response)
        print(f"✅ Parsed {len(flashcards_data)} flashcards")
        
        # NEW: Save to database
        print(f"💾 Saving to database...")

        # Convert user_id string to UUID
        try:
            user_uuid = uuid.UUID(input_data.user_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid user_id format")
        
        # Create deck
        deck = Deck(
            id=uuid.uuid4(),
            title=f"Deck from {input_data.text[:30]}...",
            source_text=input_data.text[:500],
            difficulty=input_data.difficulty,
            user_id=user_uuid 
        )
        db.add(deck)
        await db.flush()  # Get the deck ID
        
        # Create flashcards
        for card_data in flashcards_data:
            flashcard = Flashcard(
                deck_id=deck.id,
                front=card_data["front"],
                back=card_data["back"],
                user_id=user_uuid
            )
            db.add(flashcard)
        
        await db.commit()
        await db.refresh(deck)
        
        print(f"✅ Saved deck {deck.id} with {len(flashcards_data)} flashcards")
        print(f"{'='*80}\n")
        
        # Return response with deck_id
        return {
            "deck_id": str(deck.id),
            "flashcards": flashcards_data,
            "count": len(flashcards_data),
            "difficulty": input_data.difficulty,
            "processing_time": 1.5
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ ERROR: {e}")
        import traceback
        print(traceback.format_exc())
        print(f"{'='*80}\n")
        raise HTTPException(status_code=500, detail=str(e))

def parse_flashcards(ai_response: str) -> list[dict]:
    return json.loads(ai_response)


@app.get("/api/decks/{deck_id}")
async def get_deck(
    deck_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Retrieve a deck and its flashcards by ID"""
    try:
        from sqlalchemy import select
        
        # Convert string to UUID
        try:
            deck_uuid = uuid.UUID(deck_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid deck ID format")
        
        # Query deck
        result = await db.execute(
            select(Deck).where(Deck.id == deck_uuid)
        )
        deck = result.scalar_one_or_none()
        
        if not deck:
            raise HTTPException(status_code=404, detail="Deck not found")
        
        # Query flashcards
        flashcards_result = await db.execute(
            select(Flashcard).where(Flashcard.deck_id == deck_uuid)
        )
        flashcards = flashcards_result.scalars().all()
        
        return {
            "deck_id": str(deck.id),
            "title": deck.title,
            "flashcards": [
                {"front": f.front, "back": f.back} 
                for f in flashcards
            ],
            "count": len(flashcards),
            "difficulty": deck.difficulty,
            "created_at": deck.created_at.isoformat()
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching deck: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Words API endpoints

class WordCreate(BaseModel):
    word: str = Field(..., min_length=1, max_length=200)
    definition: str = Field(..., min_length=1)
    example: str = Field(default="", max_length=1000)
    pronunciation: str = Field(default="", max_length=100)
    user_id: str

class WordUpdate(BaseModel):
    word: Optional[str] = Field(None, min_length=1, max_length=200)
    definition: Optional[str] = Field(None, min_length=1)
    example: Optional[str] = Field(None, max_length=1000)
    pronunciation: Optional[str] = Field(None, max_length=100)

class WordResponse(BaseModel):
    id: str
    word: str
    definition: str
    example: str | None
    pronunciation: str | None
    status: str
    created_at: str
    updated_at: str | None

@app.get("/api/my-words", response_model=list[WordResponse])
async def get_my_words(
    user_id: str = Query(..., description="User ID"),
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page"),
    search: str = Query(default="", description="Search query"),
    db: AsyncSession = Depends(get_db)
):
    """Get all words for a specific user with pagination and search"""
    try:
        from sqlalchemy import select, func, or_
        from sqlalchemy.orm import selectinload
        
        # Convert user_id string to UUID
        try:
            user_uuid = uuid.UUID(user_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid user_id format")
        
        # Build query
        query = select(Word).where(Word.user_id == user_uuid)
        
        # Add search filter if provided
        if search:
            search_filter = or_(
                Word.word.ilike(f"%{search}%"),
                Word.definition.ilike(f"%{search}%"),
                Word.example.ilike(f"%{search}%")
            )
            query = query.where(search_filter)
        
        # Order by created_at descending (most recent first)
        query = query.order_by(Word.created_at.desc())
        
        # Get total count for pagination
        count_query = select(func.count()).select_from(Word).where(Word.user_id == user_uuid)
        if search:
            count_query = count_query.where(search_filter)
        total_result = await db.execute(count_query)
        total_count = total_result.scalar()
        
        # Apply pagination
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size)
        
        # Execute query
        result = await db.execute(query)
        words = result.scalars().all()
        
        return [
            {
                "id": str(word.id),
                "word": word.word,
                "definition": word.definition,
                "example": word.example if word.example else None,
                "pronunciation": word.pronunciation if word.pronunciation else None,
                "status": word.status,
                "created_at": word.created_at.isoformat(),
                "updated_at": word.updated_at.isoformat() if word.updated_at else None
            }
            for word in words
        ]
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching words: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/words", response_model=WordResponse)
async def create_word(
    word_data: WordCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new word"""
    try:
        # Convert user_id string to UUID
        try:
            user_uuid = uuid.UUID(word_data.user_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid user_id format")
        
        # Create word
        word = Word(
            id=uuid.uuid4(),
            user_id=user_uuid,
            word=word_data.word,
            definition=word_data.definition,
            example=word_data.example if word_data.example else None,
            pronunciation=word_data.pronunciation if word_data.pronunciation else None,
            status="pending"
        )
        
        db.add(word)
        await db.commit()
        await db.refresh(word)
        
        return {
            "id": str(word.id),
            "word": word.word,
            "definition": word.definition,
            "example": word.example if word.example else None,
            "pronunciation": word.pronunciation if word.pronunciation else None,
            "status": word.status,
            "created_at": word.created_at.isoformat(),
            "updated_at": word.updated_at.isoformat() if word.updated_at else None
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating word: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/words/{word_id}", response_model=WordResponse)
async def update_word(
    word_id: str,
    word_data: WordUpdate,
    user_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Update an existing word"""
    try:
        from sqlalchemy import select
        from datetime import datetime
        
        # Convert IDs to UUID
        try:
            word_uuid = uuid.UUID(word_id)
            user_uuid = uuid.UUID(user_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid ID format")
        
        # Get word
        result = await db.execute(
            select(Word).where(Word.id == word_uuid, Word.user_id == user_uuid)
        )
        word = result.scalar_one_or_none()
        
        if not word:
            raise HTTPException(status_code=404, detail="Word not found")
        
        # Update fields if provided
        if word_data.word is not None:
            word.word = word_data.word
        if word_data.definition is not None:
            word.definition = word_data.definition
        if word_data.example is not None:
            word.example = word_data.example if word_data.example else None
        if word_data.pronunciation is not None:
            word.pronunciation = word_data.pronunciation if word_data.pronunciation else None
        
        word.updated_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(word)
        
        return {
            "id": str(word.id),
            "word": word.word,
            "definition": word.definition,
            "example": word.example if word.example else None,
            "pronunciation": word.pronunciation if word.pronunciation else None,
            "status": word.status,
            "created_at": word.created_at.isoformat(),
            "updated_at": word.updated_at.isoformat() if word.updated_at else None
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating word: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/words/{word_id}")
async def delete_word(
    word_id: str,
    user_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Delete a word"""
    try:
        from sqlalchemy import select
        
        # Convert IDs to UUID
        try:
            word_uuid = uuid.UUID(word_id)
            user_uuid = uuid.UUID(user_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid ID format")
        
        # Get word
        result = await db.execute(
            select(Word).where(Word.id == word_uuid, Word.user_id == user_uuid)
        )
        word = result.scalar_one_or_none()
        
        if not word:
            raise HTTPException(status_code=404, detail="Word not found")
        
        await db.delete(word)
        await db.commit()
        
        return {"message": "Word deleted successfully"}
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting word: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class WordsBatchCreate(BaseModel):
    words: list[WordCreate]
    user_id: str

class WordsBatchResponse(BaseModel):
    saved: int
    skipped: int
    errors: list[str]

@app.post("/api/words/batch", response_model=WordsBatchResponse)
async def create_words_batch(
    batch_data: WordsBatchCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create multiple words at once, skipping duplicates"""
    try:
        from sqlalchemy import select
        
        # Convert user_id string to UUID
        try:
            user_uuid = uuid.UUID(batch_data.user_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid user_id format")
        
        saved_count = 0
        skipped_count = 0
        errors = []
        
        # Get existing words for this user to check duplicates
        existing_result = await db.execute(
            select(Word).where(Word.user_id == user_uuid)
        )
        existing_words = {word.word.lower() for word in existing_result.scalars().all()}
        
        # Process each word
        for word_data in batch_data.words:
            try:
                # Check for duplicate (case-insensitive)
                if word_data.word.lower() in existing_words:
                    skipped_count += 1
                    continue
                
                # Create word
                word = Word(
                    id=uuid.uuid4(),
                    user_id=user_uuid,
                    word=word_data.word,
                    definition=word_data.definition,
                    example=word_data.example if word_data.example else None,
                    pronunciation=word_data.pronunciation if word_data.pronunciation else None,
                    status="pending"
                )
                
                db.add(word)
                existing_words.add(word_data.word.lower())  # Track in memory to avoid duplicates in same batch
                saved_count += 1
                
            except Exception as e:
                errors.append(f"Error saving '{word_data.word}': {str(e)}")
        
        await db.commit()
        
        return {
            "saved": saved_count,
            "skipped": skipped_count,
            "errors": errors
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating words batch: {e}")
        raise HTTPException(status_code=500, detail=str(e))