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
  // const fullText = extractTextFromGoogleDoc(doc);
  //
  // const chunks = chunkText(fullText, 500);
  // console.log("chunks", chunks);
  // const allRedactions = [];
  //
  // for (const chunk of chunks) {
  //   const res = await fetch("http://localhost:8000/redact", {
  //     method: "POST",
  //     headers: { "Content-Type": "application/json" },
  //     body: JSON.stringify({ text: chunk, custom_request: event.data.prompt || "" }),
  //   });
  //   const result = await res.json();
  //   console.log("result", result);
  //   if (Array.isArray(result['redaction_candidates'])) allRedactions.push(...result['redaction_candidates']);
  // }
  
  const [redactedImagesMap, allRedactions] = await Promise.all([
  fetchAndRedactImages(doc),
  getTextRedactions(doc, event.data.prompt || "")
]);
  
  console.log("Redactions:", allRedactions);
  const redactedText = generateRedactedText(doc, allRedactions);
  await applyRedactedImages(redactedText, redactedImagesMap);
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
  
async function getTextRedactions(doc, customPrompt) {
  const fullText = extractTextFromGoogleDoc(doc);
  const chunks = chunkText(fullText, 500);
  const allRedactions = [];

  for (const chunk of chunks) {
    const res = await fetch("http://localhost:8000/redact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: chunk, custom_request: customPrompt }),
    });
    const result = await res.json();
    if (Array.isArray(result['redaction_candidates'])) {
      allRedactions.push(...result['redaction_candidates']);
    }
  }

  return allRedactions;
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

async function fetchAndRedactImages(doc) {
  const inlineObjects = doc.inlineObjects || {};
  const redactedImagesMap = new Map();

  const imageFetchPromises = Object.entries(inlineObjects).map(async ([objectId, obj]) => {
    const uri = obj.inlineObjectProperties?.embeddedObject?.imageProperties?.contentUri;
    if (!uri) return;

    try {
      const base64 = await fetchImageAsBase64(uri);
      const response = await fetch("http://localhost:8000/redact-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64image: base64 }),
      });

      const data = await response.json();
      if (data?.redacted_image_base64) {
        redactedImagesMap.set(objectId, data.redacted_image_base64);
      }
    } catch (error) {
      console.error(`Failed to process image ${objectId}:`, error);
    }
  });

  await Promise.all(imageFetchPromises);
  return redactedImagesMap;
}

async function fetchImageAsBase64(uri) {
  const response = await fetch(uri);
  const blob = await response.blob();
  return await blobToBase64(blob);
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const base64 = reader.result.split(',')[1]; // Remove data:*/*;base64, prefix
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
}

async function applyRedactedImages(doc, redactedImagesMap) {
  for (const [objectId, base64] of redactedImagesMap.entries()) {
    const imageObj = doc.inlineObjects?.[objectId];
    if (!imageObj) continue;
    
    const accessToken = await getAccessTokenFromBackground()

    imageObj.inlineObjectProperties.embeddedObject.imageProperties.contentUri = await uploadRedactedImageToDrive(base64, imageObj, accessToken);
  }
}

async function uploadRedactedImageToDrive(base64, fileName, accessToken) {
  const metadata = {
    name: `${fileName}.png`,
    mimeType: "image/png"
  };
  
  const imageBlob = base64ToBlob(base64)
  
  const file = new Blob([imageBlob], { type: "image/png" });
  
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", file);
  
  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: new Headers({ Authorization: `Bearer ${accessToken}` }),
    body: form,
  });
  
  const fileData = await res.json();
  
  // Make the file public (optional, or use API access)
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileData.id}/permissions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      role: "reader",
      type: "anyone"
    })
  });
  
  // Get sharable URL
  return `https://drive.google.com/uc?id=${fileData.id}`;
}

function base64ToBlob(base64, mime = 'image/png') {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length).fill(0).map((_, i) => byteCharacters.charCodeAt(i));
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mime });
}

async function getAccessTokenFromBackground() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "GET_ACCESS_TOKEN" }, (response) => {
      if (response?.success) {
        resolve(response.token);
      } else {
        reject(response?.error || "Failed to get token");
      }
    });
  });
}
