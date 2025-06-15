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
      chrome.scripting.executeScript(
        {
          target: { tabId: tabs[0].id },
          func: triggerScanOnPage,
          // Pass an empty string as the prompt for a standard scan
          args: [""],
        },
        () => {
          setTimeout(() => window.close(), 200);
        }
      );
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
      chrome.scripting.executeScript(
        {
          target: { tabId: tabs[0].id },
          func: triggerScanOnPage,
          // Pass the user's custom prompt from the textarea
          args: [promptValue],
        },
        () => {
          setTimeout(() => window.close(), 200);
        }
      );
    }
  });
});

document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll(".mui-btn").forEach((btn) => {
    btn.addEventListener("click", function (e) {
      const ripple = this.querySelector(".mui-ripple");
      if (!ripple) return;
      ripple.classList.remove("show");
      const rect = this.getBoundingClientRect();
      ripple.style.left = e.clientX - rect.left + "px";
      ripple.style.top = e.clientY - rect.top + "px";
      ripple.classList.add("show");
    });
  });
});
