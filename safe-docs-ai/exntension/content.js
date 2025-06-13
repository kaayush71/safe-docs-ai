window.addEventListener("message", async (event) => {
  if (event.source !== window || event.data.type !== "AI_REDACTOR_SCAN") return;
  const prompt = event.data.prompt || "";

  const bodyEl = document.querySelector("div.kix-appview-editor");
  const textEls = bodyEl.querySelectorAll("span.kix-lineview-text-block");
  let fullText = "";
  const spans = [];

  textEls.forEach((el) => {
    fullText += el.textContent + "\n";
    spans.push(el);
  });

  const chunks = chunkText(fullText, 3000);
  const allRedactions = [];

  for (const chunk of chunks) {
    const response = await fetch("https://YOUR-BACKEND-URL.com/redact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: chunk }),
    });
    const result = await response.json();
    if (Array.isArray(result)) allRedactions.push(...result);
  }

  highlightSnippets(spans, allRedactions);
  await redactImagesWithAPI();
});

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

function highlightSnippets(spans, redactions) {
  redactions.forEach(({ snippet, type }) => {
    spans.forEach((span) => {
      if (span.textContent.includes(snippet)) {
        span.style.backgroundColor = type === "PII" ? "#ffcccc" : "#ccffff";
      }
    });
  });
}

const redactedMap = new Map(); // Map<imgElement, { originalSrc, redactedSrc }>

async function redactImagesWithAPI() {
  const images = Array.from(document.querySelectorAll("img"));

  for (const img of images) {
    const originalSrc = img.src;

    try {
      // Draw image to canvas
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);

      const dataUrl = canvas.toDataURL("image/png");
      const base64Image = dataUrl.split(",")[1];

      const response = await fetch(
        "https://YOUR-BACKEND-URL.com/redact-image",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64Image }),
        }
      );

      const result = await response.json();
      if (result.redactedImage) {
        const redactedSrc = `data:image/png;base64,${result.redactedImage}`;
        img.src = redactedSrc;

        redactedMap.set(img, { originalSrc, redactedSrc });

        addRevertTooltip(img); // ⬅️ Add tooltip after redacting
      }
    } catch (err) {
      console.error("Image redaction failed:", err);
    }
  }
}

function addRevertTooltip(img) {
  const wrapper = document.createElement("div");
  wrapper.style.position = "relative";
  wrapper.style.display = "inline-block";

  // Insert wrapper before image
  img.parentNode.insertBefore(wrapper, img);
  wrapper.appendChild(img);

  const tooltip = document.createElement("div");
  tooltip.textContent = "Revert redaction";
  tooltip.style.position = "absolute";
  tooltip.style.top = "4px";
  tooltip.style.right = "4px";
  tooltip.style.background = "rgba(0,0,0,0.7)";
  tooltip.style.color = "#fff";
  tooltip.style.fontSize = "12px";
  tooltip.style.padding = "2px 6px";
  tooltip.style.borderRadius = "4px";
  tooltip.style.cursor = "pointer";
  tooltip.style.zIndex = "9999";
  tooltip.style.opacity = "0.8";

  tooltip.addEventListener("click", () => {
    const state = redactedMap.get(img);
    if (state) {
      img.src = state.originalSrc;
      redactedMap.delete(img);
      // remove tooltip after revert
      tooltip.remove();
    }
  });

  wrapper.appendChild(tooltip);
}
