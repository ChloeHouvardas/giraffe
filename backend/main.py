from typing import Union
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from anthropic import Anthropic
import os
from dotenv import load_dotenv
import json

load_dotenv()

print("Anthropic API Key:", os.environ.get("ANTHROPIC_API_KEY"))

app = FastAPI()

@app.get("/")
def read_root():
    return {"Hello": "World"}

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

# Response model for type safety
class FlashcardResponse(BaseModel):
    flashcards: list[dict]
    count: int
    processing_time: float

@app.post("/api/generate-flashcards", response_model=FlashcardResponse)
async def generate_flashcards(input_data: TextInput):
    try:
        client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

        
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            messages=[{
                "role": "user",
                "content": f"""
                Extract vocabulary words from the text below and create flashcards.
                
                STRICT RULES:
                1. Front: ONE word in the source language (e.g., "chien")
                2. Back: ONE word English translation (e.g., "dog")
                3. NO phrases, NO sentences, NO definitions - ONLY single words
                4. If a word has multiple translations, pick the most common one
                5. Extract at least 10-15 words if the text is long enough
                6. Return ONLY valid JSON array, no markdown, no explanation
                
                Example output:
                [
                    {{"front": "chien", "back": "dog"}},
                    {{"front": "chat", "back": "cat"}},
                    {{"front": "maison", "back": "house"}}
                ]
                
                Difficulty: {input_data.difficulty}
                
                Text to analyze:
                {input_data.text}
                """
            }]
        )
        
        # Parse AI response into structured data
        flashcards = parse_flashcards(message.content[0].text)

        return FlashcardResponse(
            flashcards=flashcards,
            count=len(flashcards),
            processing_time=1.5  # You'd calculate this
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def parse_flashcards(ai_response: str) -> list[dict]:
    return json.loads(ai_response)

# @app.post("/api/uploadtext")


    