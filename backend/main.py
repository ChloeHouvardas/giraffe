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


@app.get("/api/my-decks")
async def get_my_decks(
    user_id: str = Query(..., description="User ID"),
    search: str = Query(default="", description="Search query"),
    sort_by: str = Query(default="created_at", description="Sort by: created_at, title, count"),
    db: AsyncSession = Depends(get_db)
):
    """Get all decks for a specific user"""
    try:
        from sqlalchemy import select, func, desc, asc
        
        # Convert user_id string to UUID
        try:
            user_uuid = uuid.UUID(user_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid user_id format")
        
        # First, get all decks for the user
        decks_query = select(Deck).where(Deck.user_id == user_uuid)
        
        # Add search filter if provided
        if search:
            decks_query = decks_query.where(Deck.title.ilike(f"%{search}%"))
        
        # Apply sorting for decks
        if sort_by == "title":
            decks_query = decks_query.order_by(asc(Deck.title))
        else:  # created_at (default)
            decks_query = decks_query.order_by(desc(Deck.created_at))
        
        decks_result = await db.execute(decks_query)
        decks = decks_result.scalars().all()
        
        # Get card counts for each deck
        deck_list = []
        for deck in decks:
            # Count flashcards for this deck
            count_result = await db.execute(
                select(func.count(Flashcard.id)).where(Flashcard.deck_id == deck.id)
            )
            card_count = count_result.scalar() or 0
            
            deck_list.append({
                "id": str(deck.id),
                "title": deck.title or "Untitled Deck",
                "card_count": card_count,
                "difficulty": deck.difficulty,
                "created_at": deck.created_at.isoformat()
            })
        
        # Sort by count if needed (after getting counts)
        if sort_by == "count":
            deck_list.sort(key=lambda x: x["card_count"], reverse=True)
        
        return deck_list
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching decks: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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

class DeckUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)

@app.put("/api/decks/{deck_id}")
async def update_deck(
    deck_id: str,
    deck_data: DeckUpdate,
    user_id: str = Query(..., description="User ID"),
    db: AsyncSession = Depends(get_db)
):
    """Update a deck"""
    try:
        from sqlalchemy import select
        
        # Convert IDs to UUID
        try:
            deck_uuid = uuid.UUID(deck_id)
            user_uuid = uuid.UUID(user_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid ID format")
        
        # Get deck
        result = await db.execute(
            select(Deck).where(Deck.id == deck_uuid, Deck.user_id == user_uuid)
        )
        deck = result.scalar_one_or_none()
        
        if not deck:
            raise HTTPException(status_code=404, detail="Deck not found")
        
        # Update fields if provided
        if deck_data.title is not None:
            deck.title = deck_data.title
        
        await db.commit()
        await db.refresh(deck)
        
        return {
            "id": str(deck.id),
            "title": deck.title,
            "difficulty": deck.difficulty,
            "created_at": deck.created_at.isoformat()
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating deck: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/decks/{deck_id}")
async def delete_deck(
    deck_id: str,
    user_id: str = Query(..., description="User ID"),
    db: AsyncSession = Depends(get_db)
):
    """Delete a deck"""
    try:
        from sqlalchemy import select
        
        # Convert IDs to UUID
        try:
            deck_uuid = uuid.UUID(deck_id)
            user_uuid = uuid.UUID(user_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid ID format")
        
        # Get deck
        result = await db.execute(
            select(Deck).where(Deck.id == deck_uuid, Deck.user_id == user_uuid)
        )
        deck = result.scalar_one_or_none()
        
        if not deck:
            raise HTTPException(status_code=404, detail="Deck not found")
        
        await db.delete(deck)
        await db.commit()
        
        return {"message": "Deck deleted successfully"}
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting deck: {e}")
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

# Conversational Practice API endpoints

class ConversationMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str

class ConversationRequest(BaseModel):
    deck_id: str
    user_id: str
    messages: list[ConversationMessage]
    is_first_message: bool = False

class ConversationResponse(BaseModel):
    message: str
    words_used: list[str] = []

@app.post("/api/practice/conversation")
async def practice_conversation(
    request: ConversationRequest,
    db: AsyncSession = Depends(get_db)
):
    """Generate AI tutor response for conversational practice"""
    try:
        from sqlalchemy import select
        
        # Convert IDs to UUID
        try:
            deck_uuid = uuid.UUID(request.deck_id)
            user_uuid = uuid.UUID(request.user_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid ID format")
        
        # Get deck and verify ownership
        deck_result = await db.execute(
            select(Deck).where(Deck.id == deck_uuid, Deck.user_id == user_uuid)
        )
        deck = deck_result.scalar_one_or_none()
        
        if not deck:
            raise HTTPException(status_code=404, detail="Deck not found")
        
        # Get flashcards for this deck
        flashcards_result = await db.execute(
            select(Flashcard).where(Flashcard.deck_id == deck_uuid)
        )
        flashcards = flashcards_result.scalars().all()
        
        if not flashcards:
            raise HTTPException(status_code=400, detail="Deck has no flashcards")
        
        # Validate messages array
        if not request.messages or len(request.messages) == 0:
            raise HTTPException(status_code=400, detail="At least one message is required")
        
        # Build vocabulary list
        vocabulary_words = [{"word": f.front, "definition": f.back} for f in flashcards]
        words_list = "\n".join([f"- {w['word']} ({w['definition']})" for w in vocabulary_words])
        
        # Create system prompt
        system_prompt = f"""You are a friendly and encouraging language tutor helping a student practice vocabulary words.

VOCABULARY WORDS TO PRACTICE:
{words_list}

YOUR ROLE:
- Have a natural, engaging conversation with the student
- Naturally incorporate 3-5 vocabulary words from the list in each response
- Use the words in context so the student can understand their meaning
- Ask questions that encourage the student to use these words
- Gently correct any mistakes and explain the right usage
- Be encouraging and supportive
- Adapt your language complexity based on the student's responses

CONVERSATION STYLE:
- Keep responses conversational (2-4 sentences)
- Use clear, natural language
- If student seems confused, provide simpler explanations
- Celebrate when they use vocabulary words correctly
- Don't explicitly list the words you're using - just use them naturally

{f'Start by greeting the student and suggesting an interesting topic to discuss that would allow natural use of the vocabulary words.' if request.is_first_message else 'Continue the conversation naturally, incorporating vocabulary words.'}"""
        
        # Validate messages array
        if not request.messages or len(request.messages) == 0:
            raise HTTPException(status_code=400, detail="At least one message is required")
        
        # Prepare messages for Claude
        claude_messages = [
            {"role": msg.role, "content": msg.content}
            for msg in request.messages
        ]
        
        print(f"💬 Generating conversation response for deck {request.deck_id}")
        print(f"   Messages count: {len(claude_messages)}")
        print(f"   First message: {claude_messages[0] if claude_messages else 'NONE'}")
        
        # Get API key
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")
        
        client = Anthropic(api_key=api_key)
        
        # Call Claude API
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1000,
            system=system_prompt,
            messages=claude_messages
        )
        
        ai_response = message.content[0].text
        
        # Extract words used (simple pattern matching)
        words_used = []
        response_lower = ai_response.lower()
        for vocab in vocabulary_words:
            if vocab['word'].lower() in response_lower:
                words_used.append(vocab['word'])
        
        print(f"✅ Generated response with {len(words_used)} vocabulary words")
        
        return {
            "message": ai_response,
            "words_used": words_used
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in conversation: {e}")
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))