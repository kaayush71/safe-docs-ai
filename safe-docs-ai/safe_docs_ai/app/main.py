from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from safe_docs_ai.app.image_redactor import redact_image_and_return_base64
from safe_docs_ai.app.schemas import RedactImageRequest, RedactImageResponse, RedactRequest, RedactResponse
from safe_docs_ai.app.redactor import redact_text

app = FastAPI(
    title="AI Document Redactor",
    description="Redacts sensitive information from input text using OpenAI + LangChain",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://docs.google.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Welcome to the AI Redaction API!"}

@app.post("/redact", response_model=RedactResponse)
def redact_endpoint(request: RedactRequest):
    try:
        redaction_candidates = redact_text(request.text, request.custom_request)
        return {"redaction_candidates": redaction_candidates}
    except Exception as e:
        print("Error: ", e)
        raise HTTPException(status_code=500, detail=str(e))
    

@app.post("/redact-image", response_model=RedactImageResponse)
def redact_image_endpoint(request: RedactImageRequest):
    try: 
        redacted_base64 = redact_image_and_return_base64(request.base64image, request.custom_request)
        return {"redacted_image_base64": redacted_base64}
    except Exception as e:
        print("Error: ", e)
        raise HTTPException(status_code=500, detail=str(e))
