# Safe Doc AI

**Safe Doc AI** is a privacy-focused solution for redacting sensitive information from Google Docs using AI. It consists of a Chrome extension for Google Docs and a FastAPI backend that leverages OpenAI (GPT-4) and LangChain for text and image redaction.

---

## Features

- **Chrome Extension**:  
  - Adds a popup to Google Docs for one-click or custom-prompt redaction.
  - Scans the current document for sensitive information (PII, etc.) and redacts it using AI.
  - Redacts both text and images (using OCR + AI).
  - Creates a new redacted copy of the document in your Google Drive.

- **Backend API**:  
  - FastAPI server for text and image redaction.
  - Uses OpenAI GPT-4 (via LangChain) for context-aware redaction.
  - Image redaction via OCR (pytesseract) + GPT-4 for PII detection.
  - Customizable prompts for tailored redaction.

---


## Installation

### 1. Backend (FastAPI)

#### **Requirements**
- Python 3.9+
- [Poetry](https://python-poetry.org/docs/#installation)
- OpenAI API key

#### **Setup**

```bash
cd safe-docs-ai
poetry install
```

- Set your OpenAI API key in the environment:
  ```bash
  export OPENAI_API_KEY=sk-...
  ```

#### **Run the server**

```bash
poetry run uvicorn safe_docs_ai.app.main:app --reload
```

The API will be available at `http://localhost:8000`.

---

### 2. Chrome Extension

#### **Setup**

1. Go to `chrome://extensions` in your browser.
2. Enable "Developer mode".
3. Click "Load unpacked" and select the `safe-docs-ai/extension` directory.

#### **Permissions**

- The extension requires access to:
  - Google Docs (`https://docs.google.com/*`)
  - Google Drive API (for creating redacted docs)
  - Google Identity (for OAuth2 authentication)

---

## Usage

1. **Open a Google Doc.**
2. **Click the Safe Doc AI extension icon.**
3. **Choose:**
   - **Scan**: Redact using the default AI prompt.
   - **Scan with Prompt**: Enter a custom prompt for tailored redaction.
4. **A new redacted document** will be created in your Google Drive.

---

## How It Works

### Chrome Extension

- **Popup UI**: Material-inspired, clean, and simple.
- **Content Script**: Injects logic into Google Docs to extract content and send it to the backend.
- **Background Script**: Handles Google OAuth, fetches docs, and creates new redacted copies.

### Backend (FastAPI)

- **/redact**:  
  - Splits text into chunks.
  - Uses GPT-4 (via LangChain) to identify sensitive information based on the prompt.
  - Returns redaction candidates (text and positions).

- **/redact-image**:  
  - Decodes base64 image.
  - Uses pytesseract for OCR.
  - Uses GPT-4 to identify PII lines in the image.
  - Redacts detected PII in the image and returns a new base64 image.

---

## Configuration

- **OpenAI API Key**:  
  Set `OPENAI_API_KEY` in your environment.

- **Google OAuth2**:  
  The extension uses a pre-configured OAuth2 client for Google Docs/Drive access.

---

## Security & Privacy

- All processing is done locally or via your own backend.
- No data is sent to third parties except OpenAI (for redaction) and Google (for document access).
- You control your API keys and Google account access.

---


## Acknowledgements

- [OpenAI](https://openai.com/)
- [LangChain](https://www.langchain.com/)
- [FastAPI](https://fastapi.tiangolo.com/)
- [pytesseract](https://github.com/madmaze/pytesseract)
- [Google Docs API](https://developers.google.com/docs/api)
- [Google Drive API](https://developers.google.com/drive/api)