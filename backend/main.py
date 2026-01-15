from typing import Union, Optional
from fastapi import FastAPI, HTTPException, Depends, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from anthropic import Anthropic
import os
from dotenv import load_dotenv
import json
import io

load_dotenv()

import re
import uuid

# TODO should seperate endpoints
# Import database stuff
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from src.database import get_db
from src.models import Deck, Flashcard, Word, PracticeSession, UserSetting

app = FastAPI()

# CORS - Must be added BEFORE any routes
# Allow all localhost ports for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
            pronunciation=word_data.pronunciation if word_data.pronunciation else None
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
                    pronunciation=word_data.pronunciation if word_data.pronunciation else None
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

class ConversationSettings(BaseModel):
    immersionLevel: int = 50  # 0-100
    focusMode: str = "deck-focused"  # "deck-focused" or "natural"
    topic: str = "general"
    sessionLength: str = "standard"

class ConversationRequest(BaseModel):
    deck_id: str
    user_id: str
    messages: list[ConversationMessage]
    is_first_message: bool = False
    settings: ConversationSettings | None = None

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
        words_list = "\n".join([f"- {w['word']}: {w['definition']}" for w in vocabulary_words])
        
        # Get settings or use defaults
        settings = request.settings or ConversationSettings()
        immersion_level = settings.immersionLevel
        focus_mode = settings.focusMode
        topic = settings.topic
        
        # Determine immersion instructions
        if immersion_level <= 33:
            immersion_instructions = "Use mostly English with occasional target language words. Provide immediate translations. Keep sentences simple."
        elif immersion_level <= 66:
            immersion_instructions = "Use a 50/50 mix of English and target language. Use target language for vocabulary words and common phrases. Provide context clues."
        else:
            immersion_instructions = "Respond ENTIRELY in target language. Use natural, native-level language. Only provide English if the user explicitly asks."
        
        # Determine focus instructions
        if focus_mode == "deck-focused":
            focus_instructions = "CRITICAL: You MUST use words from this deck in nearly every response. Try to use 3-5 deck words per message. The conversation should revolve around practicing these specific words."
        else:
            focus_instructions = "Use deck words naturally when appropriate, but prioritize natural conversation flow."
        
        # Topic mapping
        topic_descriptions = {
            "general": "General conversation",
            "travel": "Travel & tourism",
            "business": "Business & work",
            "daily": "Daily life & hobbies",
            "food": "Food & dining",
            "news": "News & current events",
        }
        topic_text = topic_descriptions.get(topic, topic) if topic != "custom" else "a topic chosen by the user"
        
        # Create enhanced system prompt
        system_prompt = f"""You are a friendly and encouraging language tutor helping a student practice vocabulary words.

VOCABULARY WORDS TO PRACTICE:
{words_list}

IMMERSION LEVEL:
{immersion_instructions}

CONVERSATION FOCUS:
{focus_instructions}

CONVERSATION TOPIC: {topic_text}

YOUR ROLE:
- Have a natural, engaging conversation with the student
- {focus_instructions}
- Gently correct mistakes and explain why
- Ask questions that encourage the student to use vocabulary words
- Be encouraging and supportive
- Adapt complexity based on student responses

FORMATTING RULES:
- When you use a deck vocabulary word, wrap it in <vocab>word</vocab> tags
- Example: "That's a very <vocab>beneficial</vocab> approach!"
- When using words that might be challenging for a language learner, wrap them in <unknown>word</unknown> tags
- Example: "We should <unknown>procrastinate</unknown> less."
- This helps the student identify which words they're practicing

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

# Practice Session and Stats API endpoints

class SessionCreate(BaseModel):
    user_id: str
    deck_id: Optional[str] = None
    practice_type: str = Field(default="flashcard", pattern="^(flashcard|conversation)$", description="Type of practice: flashcard or conversation")
    duration_seconds: int = Field(..., ge=1, description="Practice duration in seconds")

class SessionResponse(BaseModel):
    id: str
    user_id: str
    deck_id: str | None
    practice_type: str
    duration_seconds: int
    completed_at: str

@app.post("/api/sessions", response_model=SessionResponse)
async def create_session(
    session_data: SessionCreate,
    db: AsyncSession = Depends(get_db)
):
    """Save a practice session"""
    try:
        # Convert user_id string to UUID
        try:
            user_uuid = uuid.UUID(session_data.user_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid user_id format")
        
        deck_uuid = None
        if session_data.deck_id:
            try:
                deck_uuid = uuid.UUID(session_data.deck_id)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid deck_id format")
        
        # Create session
        # IMPORTANT: duration_seconds must be in SECONDS, not minutes
        # Frontend sends seconds, we store seconds directly
        duration_seconds = session_data.duration_seconds
        if duration_seconds < 1:
            raise HTTPException(status_code=400, detail="Duration must be at least 1 second")
        
        # Log for debugging (can be removed in production)
        print(f"Saving session: {duration_seconds} seconds ({duration_seconds / 60:.2f} minutes)")
        
        session = PracticeSession(
            id=uuid.uuid4(),
            user_id=user_uuid,
            deck_id=deck_uuid,
            practice_type=session_data.practice_type,
            duration_seconds=duration_seconds  # Stored as SECONDS
        )
        
        db.add(session)
        await db.commit()
        await db.refresh(session)
        
        return {
            "id": str(session.id),
            "user_id": str(session.user_id),
            "deck_id": str(session.deck_id) if session.deck_id else None,
            "practice_type": session.practice_type,
            "duration_seconds": session.duration_seconds,
            "completed_at": session.completed_at.isoformat()
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def calculate_stats_for_type(db: AsyncSession, user_uuid, start_of_day, practice_type: str):
    """Helper function to calculate stats for a specific practice type"""
    from sqlalchemy import select, func
    
    # Query sessions for this type
    result = await db.execute(
        select(func.sum(PracticeSession.duration_seconds))
        .where(
            PracticeSession.user_id == user_uuid,
            PracticeSession.completed_at >= start_of_day,
            PracticeSession.practice_type == practice_type
        )
    )
    # Sum all duration_seconds (which are stored in SECONDS)
    total_seconds = result.scalar() or 0
    
    # Convert to minutes for display (integer division)
    # IMPORTANT: total_seconds is in SECONDS, we convert to minutes here
    total_minutes = total_seconds // 60
    
    # Get session count
    count_result = await db.execute(
        select(func.count(PracticeSession.id))
        .where(
            PracticeSession.user_id == user_uuid,
            PracticeSession.completed_at >= start_of_day,
            PracticeSession.practice_type == practice_type
        )
    )
    session_count = count_result.scalar() or 0
    
    return {
        "total_minutes": total_minutes,
        "total_seconds": total_seconds,
        "session_count": session_count
    }

@app.get("/api/stats/daily")
async def get_daily_stats(
    user_id: str = Query(..., description="User ID"),
    db: AsyncSession = Depends(get_db)
):
    """Get today's practice statistics (separated by session type)"""
    try:
        from sqlalchemy import select, func
        from datetime import datetime, timezone
        
        # Convert user_id string to UUID
        try:
            user_uuid = uuid.UUID(user_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid user_id format")
        
        # Get start of today (UTC)
        now = datetime.now(timezone.utc)
        start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Get stats for each session type
        flashcard_stats = await calculate_stats_for_type(db, user_uuid, start_of_day, "flashcard")
        conversation_stats = await calculate_stats_for_type(db, user_uuid, start_of_day, "conversation")
        
        # Calculate combined totals
        total_minutes = flashcard_stats["total_minutes"] + conversation_stats["total_minutes"]
        total_seconds = flashcard_stats["total_seconds"] + conversation_stats["total_seconds"]
        total_session_count = flashcard_stats["session_count"] + conversation_stats["session_count"]
        
        # Get user's daily goal
        settings_result = await db.execute(
            select(UserSetting).where(UserSetting.user_id == user_uuid)
        )
        user_setting = settings_result.scalar_one_or_none()
        daily_goal_minutes = user_setting.daily_goal_minutes if user_setting else 15
        
        return {
            "flashcard": {
                **flashcard_stats,
                "progress_percentage": min(100, int((flashcard_stats["total_minutes"] / daily_goal_minutes) * 100)) if daily_goal_minutes > 0 else 0,
                "goal_reached": flashcard_stats["total_minutes"] >= daily_goal_minutes
            },
            "conversation": {
                **conversation_stats,
                "progress_percentage": min(100, int((conversation_stats["total_minutes"] / daily_goal_minutes) * 100)) if daily_goal_minutes > 0 else 0,
                "goal_reached": conversation_stats["total_minutes"] >= daily_goal_minutes
            },
            "combined": {
                "total_minutes": total_minutes,
                "total_seconds": total_seconds,
                "session_count": total_session_count,
                "daily_goal_minutes": daily_goal_minutes,
                "progress_percentage": min(100, int((total_minutes / daily_goal_minutes) * 100)) if daily_goal_minutes > 0 else 0,
                "goal_reached": total_minutes >= daily_goal_minutes
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching daily stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class UserSettingUpdate(BaseModel):
    daily_goal_minutes: int = Field(..., ge=1, le=480, description="Daily goal in minutes (1-480)")

@app.get("/api/user-settings")
async def get_user_settings(
    user_id: str = Query(..., description="User ID"),
    db: AsyncSession = Depends(get_db)
):
    """Get user settings"""
    try:
        from sqlalchemy import select
        
        # Convert user_id string to UUID
        try:
            user_uuid = uuid.UUID(user_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid user_id format")
        
        result = await db.execute(
            select(UserSetting).where(UserSetting.user_id == user_uuid)
        )
        user_setting = result.scalar_one_or_none()
        
        # If no settings exist, return defaults
        if not user_setting:
            return {
                "daily_goal_minutes": 15,
                "created_at": None,
                "updated_at": None
            }
        
        return {
            "daily_goal_minutes": user_setting.daily_goal_minutes,
            "created_at": user_setting.created_at.isoformat(),
            "updated_at": user_setting.updated_at.isoformat() if user_setting.updated_at else None
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching user settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/user-settings")
async def update_user_settings(
    user_id: str = Query(..., description="User ID"),
    settings_data: UserSettingUpdate = ...,
    db: AsyncSession = Depends(get_db)
):
    """Update user settings"""
    try:
        from sqlalchemy import select
        from datetime import datetime
        
        # Convert user_id string to UUID
        try:
            user_uuid = uuid.UUID(user_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid user_id format")
        
        result = await db.execute(
            select(UserSetting).where(UserSetting.user_id == user_uuid)
        )
        user_setting = result.scalar_one_or_none()
        
        if not user_setting:
            # Create new settings
            user_setting = UserSetting(
                id=uuid.uuid4(),
                user_id=user_uuid,
                daily_goal_minutes=settings_data.daily_goal_minutes
            )
            db.add(user_setting)
        else:
            # Update existing settings
            user_setting.daily_goal_minutes = settings_data.daily_goal_minutes
            user_setting.updated_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(user_setting)
        
        return {
            "daily_goal_minutes": user_setting.daily_goal_minutes,
            "created_at": user_setting.created_at.isoformat(),
            "updated_at": user_setting.updated_at.isoformat() if user_setting.updated_at else None
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating user settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Speech-to-Text endpoint for Firefox
@app.post("/api/speech-to-text")
async def speech_to_text(audio: UploadFile = File(...)):
    """
    Convert audio to text using Web Speech API polyfill or external service.
    For Firefox compatibility, this endpoint receives audio and returns transcription.
    """
    try:
        # Read audio file
        audio_bytes = await audio.read()
        
        # For now, return a placeholder response
        # In production, you would:
        # 1. Use Google Cloud Speech-to-Text API
        # 2. Use Azure Speech Services
        # 3. Use AWS Transcribe
        # 4. Use a local speech recognition library
        
        # Placeholder: This would need to be replaced with actual speech recognition
        # For now, we'll use a simple approach that works with browser's built-in capabilities
        
        # Note: For a production implementation, you would:
        # - Save audio file temporarily
        # - Call speech recognition API (Google Cloud, Azure, etc.)
        # - Return transcription
        
        # Temporary solution: Return error suggesting to use Chrome/Edge
        # Or implement with a service like Google Cloud Speech-to-Text
        
        raise HTTPException(
            status_code=501, 
            detail="Speech-to-text service not configured. Please use Chrome or Edge for voice input, or configure a speech recognition service in the backend."
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error processing speech-to-text: {e}")
        raise HTTPException(status_code=500, detail=str(e))