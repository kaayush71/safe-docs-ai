from safe_docs_ai.app.prompts import REDATION_PROMPTS
from safe_docs_ai.app.utils import chunk_text
from safe_docs_ai.app.config import OPENAI_API_KEY
from typing import List
import json
import openai

CHUNK_SIZE = 500

def redact_text(text: str, custom_request: str) -> List[str]:
    if not OPENAI_API_KEY:
        raise ValueError("OpenAI API key not found. Please set OPENAI_API_KEY environment variable.")
    
    chunks = chunk_text(text, chunk_size=CHUNK_SIZE)
    redaction_candidates = []

    # Analyze the custom request to understand specific redaction requirements
    custom_request_analysis = openai.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": "You are a document redaction expert. Analyze the user's request and provide specific redaction requirements in a clear, structured format."},
            {"role": "user", "content": f"Analyze this redaction request and explain what specific types of information should be redacted: {custom_request}"}
        ],
        temperature=0.1
    )
    
    custom_requirements = custom_request_analysis.choices[0].message.content 
    
    for chunk_num, chunk in enumerate(chunks, 0):
        print(f"Processing chunk {chunk_num} of {len(chunks)}")
        prompt = REDATION_PROMPTS["basic"].format(
            input_text=chunk,
            custom_requirements=custom_requirements
        )
        response = openai.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a precise document redaction assistant. Always return a list of objects"},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1
        )
        analysis = response.choices[0].message.content
        
        # If the AI identifies sensitive information, add the chunk to candidates
        parsed_list = json.loads(analysis)
        for item in parsed_list:
            item["position_start"] = item["position_start"] + chunk_num * CHUNK_SIZE
            item["position_end"] = item["position_end"] + chunk_num * CHUNK_SIZE
            redaction_candidates.append(item)

    print("Redaction Candidates: ", redaction_candidates)
    return redaction_candidates
