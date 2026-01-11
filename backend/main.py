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
                Generate flashcards from the text below.
                Return ONLY valid JSON in this format:

                [
                {{ "front": "...", "back": "..." }}
                ]

                Text:
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



    