chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_DOC_CONTENT') {
    handleGoogleDocFetch(message.documentId, sendResponse);
    return true;
  }
  
  if (message.type === 'INSERT_REDACTED_TEXT') {
    console.log("Inserting redacted text for document:", message.documentId);
    console.log("Redacted text content:", message.redactedText);
    insertRedactedVersion(message.documentId, message.redactedText);
    return true;
  }
});

async function handleGoogleDocFetch(documentId, sendResponse) {
  try {
    const token = await getAccessToken();
    console.log("token", token);
    const response = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const doc = await response.json();
    sendResponse({ success: true, data: doc });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

function getAccessToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        console.log("Error retrieving access token:", chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
      } else {
        console.log("Access token retrieved:", token);
        resolve(token);
      }
    });
  });
}

async function insertRedactedVersion(documentId, redactedText) {
  try {
    const token = await getAccessToken();

    // Step 1: Fetch the original document to get the title
    const originalDocRes = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}`, {
      headers: {Authorization: `Bearer ${token}`},
    });
    const originalDoc = await originalDocRes.json();
    const originalTitle = originalDoc.title || 'Untitled';
    const newTitle = `Redacted: ${originalTitle}`;

    // Step 2: Create a new document
    const createDocRes = await fetch('https://docs.googleapis.com/v1/documents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({title: newTitle}),
    });
    const newDoc = await createDocRes.json();
    const newDocId = newDoc.documentId;
  }
  catch (error) {
    console.error("Error creating new document:", error);
  }
}
