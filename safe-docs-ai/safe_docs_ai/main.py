import base64
from io import BytesIO

from PIL import Image, ImageDraw
import pytesseract
from pytesseract import Output
from langchain_community.chat_models import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage
from dotenv import load_dotenv
import os

load_dotenv()
os.environ["OPENAI_API_KEY"] = os.getenv("OPENAI_API_KEY")

def encode_image_to_base64(image_path: str) -> str:
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")

def build_pii_detection_prompt(text_lines):
    text = "\n".join(text_lines)
    return [
        SystemMessage(content="You are a PII detection expert."),
        HumanMessage(content=f"""Here is the text extracted from an image. Identify which lines contain PII (personally identifiable information) such as emails, phone numbers, names, addresses, SSNs, etc.
        
Return only the exact lines that contain PII, nothing else.

Text:
{text}
""")
    ]

def detect_pii_lines_with_gpt(text_lines):
    llm = ChatOpenAI(model="gpt-4", temperature=0)
    messages = build_pii_detection_prompt(text_lines)
    response = llm.invoke(messages)
    pii_lines = [line.strip() for line in response.content.splitlines() if line.strip()]
    return pii_lines

def redact_pii_in_image(image_path, pii_lines):
    image = Image.open(image_path)
    draw = ImageDraw.Draw(image)
    ocr_data = pytesseract.image_to_data(image, output_type=Output.DICT)

    # Reconstruct line-wise text for better redaction context
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

def redact_image_and_return_base64(image_path):
    # Step 1: OCR
    ocr_data = pytesseract.image_to_data(Image.open(image_path), output_type=Output.DICT)
    lines = [text.strip() for text in ocr_data["text"] if text.strip()]

    # Step 2: Use GPT to detect PII
    pii_lines = detect_pii_lines_with_gpt(lines)
    print(f"Detected PII lines: {pii_lines}")

    # Step 3: Redact image
    redacted_image = redact_pii_in_image(image_path, pii_lines)
    local_filename = "redacted_" + os.path.basename(image_path)
    redacted_image.save(local_filename)
    print(f"\n✅ Redacted image saved locally as: {local_filename}")

    # Step 4: Convert redacted image to base64
    from io import BytesIO
    buffer = BytesIO()
    redacted_image.save(buffer, format="PNG")
    base64_redacted = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return base64_redacted

def extract_text_from_base64_image(base64_str):
    # Step 1: Decode base64 to image bytes
    image_data = base64.b64decode(base64_str)
    image = Image.open(BytesIO(image_data))

    # Step 2: Use Tesseract OCR
    extracted_text = pytesseract.image_to_string(image)
    return extracted_text

# Example usage
if __name__ == "__main__":
    redacted_base64 = redact_image_and_return_base64("sample_image.png")
    print("Base64 of redacted image:\n")
    print(redacted_base64[:200] + "...")  # print first 200 chars only
    text = extract_text_from_base64_image(redacted_base64)
    print(f"\n📝 Extracted text from redacted image:\n{text}")
