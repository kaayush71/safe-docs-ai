from pydantic import BaseModel
from typing import List

class RedactRequest(BaseModel):
    text: str
    custom_request: str

class RedactImageRequest(BaseModel):
    base64image: str
    custom_request: str

class RedactResponse(BaseModel):
    redaction_candidates: List[dict]

class RedactImageResponse(BaseModel):
    redacted_image_base64: str