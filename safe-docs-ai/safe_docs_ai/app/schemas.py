from pydantic import BaseModel
from typing import List

class RedactRequest(BaseModel):
    text: str

class RedactImageRequest(BaseModel):
    imagePath: str

class RedactResponse(BaseModel):
    redaction_candidates: List[dict]

class RedactImageResponse(BaseModel):
    redacted_text: str