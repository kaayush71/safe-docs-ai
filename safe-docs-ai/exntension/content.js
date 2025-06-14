function getDocumentId() {
  const matches = window.location.pathname.match(/\/d\/([^/]+)/);
  return matches ? matches[1] : null;
}

window.addEventListener("message", async (event) => {
  console.log("Received message from:", event.data);
  if (event.source !== window || event.data.type !== "AI_REDACTOR_SCAN") return;
  const documentId = getDocumentId();
  console.log(`Document ID found: ${documentId}`);
  if (!documentId) return console.error("No document ID found in URL.");

  const response = await chrome.runtime.sendMessage({
    type: "GET_DOC_CONTENT",
    documentId
  });

  console.log("Response from background script:", response);
  if (!response.success) {
    console.error("Failed to fetch document from Google Docs API:", response.error);
    return;
  }

  const doc = response.data;
  const fullText = extractTextFromGoogleDoc(doc);

  const chunks = chunkText(fullText, 500);
  console.log("chunks", chunks);
  const allRedactions = [];

  for (const chunk of chunks) {
    const res = await fetch("http://localhost:8000/redact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: chunk, custom_request: event.data.prompt || "" }),
    });
    const result = await res.json();
    console.log("result", result);
    if (Array.isArray(result['redaction_candidates'])) allRedactions.push(...result['redaction_candidates']);
  }
  
  console.log("Redactions:", allRedactions);
  const redactedText = generateRedactedText(doc, allRedactions);
  console.log("Redacted Version:\n", redactedText);
  
  await chrome.runtime.sendMessage({
  type: "INSERT_REDACTED_TEXT",
  documentId,
  redactedText
});

});

function extractTextFromGoogleDoc(doc) {
  let text = "";
  const body = doc.body?.content || [];

  for (const element of body) {
    if (element.paragraph) {
      for (const el of element.paragraph.elements) {
        text += el.textRun?.content || "";
      }
      text += "\n";
    }
  }
  return text;
}


  function chunkText(text, maxLength) {
    const chunks = [];
    let start = 0;

    while (start < text.length) {
      let end = Math.min(start + maxLength, text.length);

      // Try to break on a space
      if (end < text.length) {
        const spaceIndex = text.lastIndexOf(" ", end);
        if (spaceIndex > start) {
          end = spaceIndex;
        }
      }

      chunks.push(text.slice(start, end));
      start = end + 1; // Move past the space
    }

    return chunks;
  }
  
function generateRedactedText(doc, redactions) {
  const body = doc.body?.content || [];

  // Build a set of redaction texts for faster lookup
  const redactionMap = new Map();
  for (const item of redactions) {
    redactionMap.set(item.text, '*'.repeat(item.text.length));
  }

  for (const element of body) {
    if (!element.paragraph) continue;

    for (const el of element.paragraph.elements || []) {
      const textRun = el.textRun;
      if (!textRun || !textRun.content) continue;

      let original = textRun.content;
      let modified = original;

      // Replace all redaction matches in this text run
      for (const [targetText, replacement] of redactionMap.entries()) {
        const pattern = new RegExp(escapeRegExp(targetText), 'g');
        modified = modified.replace(pattern, replacement);
      }

      // If modified, update the content
      if (modified !== original) {
        textRun.content = modified;
      }
    }
  }
  
  console.log("Redacted document body:", body);
  return doc;
}

// Utility function to escape RegExp characters in redaction text
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
