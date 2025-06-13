import pytesseract
import base64
import os

from fastapi import FastAPI, HTTPException
from safe_docs_ai.app.image_redactor import extract_text_from_base64_image, redact_image_and_return_base64
from safe_docs_ai.app.schemas import RedactImageRequest, RedactImageResponse, RedactRequest, RedactResponse
from safe_docs_ai.app.redactor import redact_text
from io import BytesIO
from PIL import Image, ImageDraw
from pytesseract import Output
from langchain_community.chat_models import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage

app = FastAPI(
    title="AI Document Redactor",
    description="Redacts sensitive information from input text using OpenAI + LangChain",
    version="1.0.0"
)

@app.get("/")
def read_root():
    return {"message": "Welcome to the AI Redaction API!"}

@app.post("/redact", response_model=RedactResponse)
def redact_endpoint(request: RedactRequest):
    try:
        redaction_candidates = redact_text(request.text)
        return {"redaction_candidates": redaction_candidates}
    except Exception as e:
        print("Error: ", e)
        raise HTTPException(status_code=500, detail=str(e))
    

@app.post("/redact-image", response_model=RedactImageResponse)
def redact_image_endpoint(request: RedactImageRequest):
    try: 
        redacted_base64 = redact_image_and_return_base64(request.imagePath)
        print("Base64 of redacted image:\n")
        print(redacted_base64[:200] + "...")  # print first 200 chars only
        text = extract_text_from_base64_image(redacted_base64)
        print(f"\n📝 Extracted text from redacted image:\n{text}")
        return {"redacted_text": text}
    except Exception as e:
        print("Error: ", e)
        raise HTTPException(status_code=500, detail=str(e))
