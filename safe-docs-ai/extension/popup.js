function triggerScanOnPage(customPrompt) {
  window.postMessage(
    {
      type: "AI_REDACTOR_SCAN",
      prompt: customPrompt || "", // Ensure prompt is at least an empty string
    },
    "*"
  );
}

document.getElementById("scanButton").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    // Check if we have an active tab
    if (tabs.length > 0) {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: triggerScanOnPage,
        // Pass an empty string as the prompt for a standard scan
        args: [""],
      });
    }
  });
});

/**
 * Event Listener for the "Scan with Custom Prompt" button.
 * Sends a message containing the text from the input field.
 */
document.getElementById("scanPromptButton").addEventListener("click", () => {
  const promptValue = document.getElementById("customPrompt").value;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    // Check if we have an active tab
    if (tabs.length > 0) {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: triggerScanOnPage,
        // Pass the user's custom prompt from the textarea
        args: [promptValue],
      });
    }
  });
});