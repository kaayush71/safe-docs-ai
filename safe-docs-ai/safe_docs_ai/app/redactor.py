from safe_docs_ai.app.prompts import REDATION_PROMPTS
from safe_docs_ai.app.utils import chunk_text
from safe_docs_ai.app.config import OPENAI_API_KEY
from typing import List
import json
import openai

CHUNK_SIZE = 500

def validate_redaction(text: str, redacted_items: List[str], custom_requirements: str) -> List[str]:
    """
    Validates if any sensitive information was missed in the initial redaction pass.
    Returns a list of additional items that should be redacted.
    """
    validation_prompt = REDATION_PROMPTS["validation"].format(
        text=text,
        already_redacted_items=json.dumps(redacted_items, indent=2),
        custom_requirements=custom_requirements
    )
    
    validation_response = openai.chat.completions.create(
        model="gpt-4.1",
        messages=[
            {"role": "system", "content": "You are a precise document security validator. Always return a list of objects."},
            {"role": "user", "content": validation_prompt}
        ],
        temperature=0
    )
    
    try:
        additional_items = json.loads(validation_response.choices[0].message.content)
        return additional_items
    except json.JSONDecodeError:
        return []

def redact_text(text: str, custom_request: str) -> List[str]:
    if not OPENAI_API_KEY:
        raise ValueError("OpenAI API key not found. Please set OPENAI_API_KEY environment variable.")
    
    redaction_candidates = []

    # Analyze the custom request to understand specific redaction requirements
    custom_request_analysis = openai.chat.completions.create(
        model="gpt-4.1",
        messages=[
            {"role": "system", "content": "You are a document redaction expert. Analyze the user's request and provide specific redaction requirements in a clear, structured format."},
            {"role": "user", "content": f"Analyze this redaction request and explain what specific types of information should be redacted: {custom_request}"}
        ],
        temperature=0
    )
    
    custom_requirements = custom_request_analysis.choices[0].message.content 
    
    prompt = REDATION_PROMPTS["general"].format(
        input_text=text,
        custom_requirements=custom_requirements
    )
    response = openai.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": "You are a precise document redaction assistant. Always return a list of objects"},
            {"role": "user", "content": prompt}
        ],
        temperature=0
    )
    analysis = response.choices[0].message.content
    
    parsed_list = json.loads(analysis)
    for item in parsed_list: 
        redaction_candidates.append(item)

    # Add validation step
    additional_candidates = validate_redaction(text, redaction_candidates, custom_requirements)
    redaction_candidates.extend(additional_candidates)

    return redaction_candidates
