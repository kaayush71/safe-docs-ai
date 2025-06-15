import base64
from io import BytesIO
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
    return [
        SystemMessage(content="You are a PII detection expert."),
        HumanMessage(content=(
            f"""Here is the text extracted from an image. Identify which lines contain PII (personally identifiable information)
                such as emails, phone numbers, names, addresses, SSNs, etc.
                Also include any additional custom redaction requirements, if any: {custom_request}

                Return only the exact lines that contain PII, nothing else.

                Text:
                {text}"""
        ))
    ]


def detect_pii_lines_with_gpt(text_lines, custom_request):
    llm = ChatOpenAI(model="gpt-4", temperature=0)
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
