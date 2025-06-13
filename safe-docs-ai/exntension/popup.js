document.getElementById("scanButton").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      files: ["content.js"],
    });
  });
});

document.getElementById("scanPromptButton").addEventListener("click", () => {
  const promptValue = document.getElementById("customPrompt").value;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: runScanWithPrompt,
      args: [promptValue],
    });
  });
});
