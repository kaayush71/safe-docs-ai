import base64
from io import BytesIO

import openai
from PIL import Image, ImageDraw
import pytesseract
from pytesseract import Output
from langchain_community.chat_models import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage


def decode_base64_to_image(base64_str: str) -> Image.Image:
    image_data = base64.b64decode(base64_str)
    return Image.open(BytesIO(image_data))


def encode_image_to_base64(image: Image.Image) -> str:
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def build_pii_detection_prompt(text_lines, custom_request = ''):
    text = "\n".join(text_lines)
    custom_request_analysis = openai.chat.completions.create(
        model="gpt-4.1",
        messages=[
            {"role": "system",
             "content": "You are a document redaction expert. Analyze the user's request and provide specific redaction requirements in a clear, structured format."},
            {"role": "user",
             "content": f"Analyze this redaction request and explain what specific types of information should be redacted: {custom_request}"}
        ],
        temperature=0
    )

    custom_requirements = custom_request_analysis.choices[0].message.content
    
    return [
        SystemMessage(content="You are a PII detection expert."),
        HumanMessage(content=(
            f"""
                Instructions:
                - Identify which words in the extracted text contain PII 
                    (personally identifiable information), such as emails, phone numbers, names, addresses, SSNs, etc.
                - Also include any additional custom redaction requirements: {custom_requirements}
                - Return only a JSON array of the exact words that contain PII, with no extra text, explanation, or formatting.
                - If no words contain PII, return an empty array: []

                Workflow:
                1. Read the extracted text.
                2. Identify all words that match the PII categories or custom requirements.
                3. For each match, add the exact word to the output array.
                4. Return the array as your only output.

                Output format example:
                [
                "john.doe@email.com",
                "123-45-6789"
                ]

                Do not:
                - Add any explanation, prose, or formatting outside the JSON array.
                - Repeat the instructions or categories in your output.

                Text:
                {text}
            """
        ))
    ]


def detect_pii_lines_with_gpt(text_lines, custom_request):
    llm = ChatOpenAI(model="gpt-4.1", temperature=0)
    messages = build_pii_detection_prompt(text_lines, custom_request)
    response = llm.invoke(messages)
    pii_lines = [line.strip() for line in response.content.splitlines() if line.strip()]
    return pii_lines


def redact_pii_in_image(image: Image.Image, pii_lines):
    draw = ImageDraw.Draw(image)
    ocr_data = pytesseract.image_to_data(image, output_type=Output.DICT)

    n_boxes = len(ocr_data["text"])
    for i in range(n_boxes):
        text = ocr_data["text"][i].strip()
        if text == "":
            continue

        for pii_line in pii_lines:
            if text in pii_line:
                (x, y, w, h) = (
                    ocr_data["left"][i],
                    ocr_data["top"][i],
                    ocr_data["width"][i],
                    ocr_data["height"][i],
                )
                draw.rectangle([x, y, x + w, y + h], fill="black")
                break

    return image


def redact_image_and_return_base64(base64_image_str: str, custom_request: str) -> str:
    # Step 1: Decode base64 → Image
    image = decode_base64_to_image(base64_image_str)

    # Step 2: OCR for all text lines
    ocr_data = pytesseract.image_to_data(image, output_type=Output.DICT)
    lines = [text.strip() for text in ocr_data["text"] if text.strip()]

    # Step 3: Detect PII lines using GPT
    pii_lines = detect_pii_lines_with_gpt(lines, custom_request)
    print(f"Detected PII lines: {pii_lines}")

    # Step 4: Redact PII in image
    redacted_image = redact_pii_in_image(image, pii_lines)

    # Step 5: Encode redacted image back to base64
    return encode_image_to_base64(redacted_image)


def extract_text_from_base64_image(base64_str):
    image = decode_base64_to_image(base64_str)
    return pytesseract.image_to_string(image)
