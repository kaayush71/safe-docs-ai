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
  
    if (message.type === "GET_ACCESS_TOKEN") {
      getAccessToken()
        .then((token) => sendResponse({ success: true, token }))
        .catch((error) => sendResponse({ success: false, error: error.message || error }));
      return true; // Keep message channel open for async
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
    const redactedDoc = newDoc.documentId;
    console.log("New document created with ID:", redactedDoc);

    const requestsText = generateFormattedRedactedRequests(redactedText);
    console.log("generateFormattedRedactedRequests: ", requestsText);
    const response = await fetch(`https://docs.googleapis.com/v1/documents/${redactedDoc}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({requests: requestsText}),
    });

    console.log("Batch update response:", response);

    const requests = generateStyleResetRequestsFromDoc(redactedText);
    console.log("generateStyleResetRequestsFromDoc: ", requests);
    const  res = await fetch(`https://docs.googleapis.com/v1/documents/${redactedDoc}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    });

    console.log("Batch update response:", res);
    }
    catch (error) {
      console.error("Error creating new document:", error);
    }
}

function generateStyleResetRequestsFromDoc(doc) {
  const content = doc.body?.content || [];
  console.log("generateStyleResetRequestsFromDoc: ", doc)
  const requests = [];

  let seenStyles = {
    bold: false,
    italic: false,
    underline: false,
  };

  for (let i = 0; i < content.length; i++) {
    const section = content[i];
    if (!section.paragraph || !Array.isArray(section.paragraph.elements)) continue;

    const elements = section.paragraph.elements;

    for (let j = 0; j < elements.length; j++) {
      const el = elements[j];
      const textRun = el.textRun;
      const inlineObject = el.inlineObjectElement;

      let textStyle = null;
      if (textRun?.textStyle) {
        textStyle = textRun.textStyle;
      } else if (inlineObject?.textStyle) {
        textStyle = inlineObject.textStyle;
      } else {
        continue;
      }

      const currentStyle = textStyle;
      const stylesToUnset = {};
      const startIndex = el.startIndex;
      const endIndex = el.endIndex;

      // Track seen styles
      if (currentStyle.bold === true) seenStyles.bold = true;
      if (currentStyle.italic === true) seenStyles.italic = true;
      if (currentStyle.underline === true) seenStyles.underline = true;

      // Force unset if previously seen but not explicitly true
      if (seenStyles.bold && currentStyle.bold !== true) stylesToUnset.bold = false;
      if (seenStyles.italic && currentStyle.italic !== true) stylesToUnset.italic = false;
      if (seenStyles.underline && currentStyle.underline !== true) stylesToUnset.underline = false;

      if (Object.keys(stylesToUnset).length > 0 && startIndex != null && endIndex != null) {
        requests.push({
          updateTextStyle: {
            range: {
              startIndex,
              endIndex,
            },
            textStyle: stylesToUnset,
            fields: Object.keys(stylesToUnset).join(','),
          },
        });
      }
    }
  }

  return requests;
}


function generateFormattedRedactedRequests(doc) {
  const requests = [];
  const content = doc.body?.content || [];
  const inlineObjects = doc.inlineObjects || {};

  let currentIndex = 1;

  for (const section of content) {
    if (!section.paragraph || !Array.isArray(section.paragraph.elements)) continue;

    const paragraph = section.paragraph;
    const elements = paragraph.elements;

    for (const el of elements) {
      const textRun = el.textRun;
      const inlineObject = el.inlineObjectElement;

      if (textRun?.content) {
        // Insert the text
        requests.push({
          insertText: {
            location: { index: currentIndex },
            text: textRun.content
          }
        });

        const length = textRun.content.length;

        // Apply the textStyle
        if (textRun.textStyle && Object.keys(textRun.textStyle).length > 0) {
          requests.push({
            updateTextStyle: {
              range: {
                startIndex: currentIndex,
                endIndex: currentIndex + length
              },
              textStyle: textRun.textStyle,
              fields: Object.keys(textRun.textStyle).join(',')
            }
          });
        }

        currentIndex += length;

      } else if (inlineObject?.inlineObjectId) {
        const objectId = inlineObject.inlineObjectId;
        const object = inlineObjects[objectId];
        const embeddedImage = object?.inlineObjectProperties?.embeddedObject?.imageProperties?.contentUri;

        if (!embeddedImage) continue; // Skip if we can't resolve the URI

        // Insert the image using the resolved URI
        requests.push({
          insertInlineImage: {
            location: { index: currentIndex },
            uri: embeddedImage,
            objectSize: object?.inlineObjectProperties?.embeddedObject?.size || undefined,
          }
        });

        // Apply textStyle if available
        if (inlineObject.textStyle && Object.keys(inlineObject.textStyle).length > 0) {
          requests.push({
            updateTextStyle: {
              range: {
                startIndex: currentIndex,
                endIndex: currentIndex + 1
              },
              textStyle: inlineObject.textStyle,
              fields: Object.keys(inlineObject.textStyle).join(',')
            }
          });
        }

        currentIndex += 1; // Image occupies 1 character space
      }
    }

    // Ensure newline after paragraph
    const lastEl = elements[elements.length - 1];
    const endsWithNewline = lastEl?.textRun?.content?.endsWith('\n');
    if (!endsWithNewline) {
      requests.push({
        insertText: {
          location: { index: currentIndex },
          text: '\n'
        }
      });
      currentIndex += 1;
    }
  }

  return requests;
}