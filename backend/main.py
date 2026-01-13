from typing import Union
from fastapi import FastAPI, HTTPException, Depends
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
from src.models import Deck, Flashcard

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