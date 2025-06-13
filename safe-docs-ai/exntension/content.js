window.addEventListener("message", async (event) => {
    if (event.source !== window || event.data.type !== "AI_REDACTOR_SCAN") return;

    const bodyEl = document.querySelector("div.kix-appview-editor");
    const textEls = bodyEl.querySelectorAll("span.kix-lineview-text-block");
    let fullText = "";
    const spans = [];

    textEls.forEach(el => {
        fullText += el.textContent + "\n"; // Concatenate text content
        spans.push(el);
    });

    // Log the full document content to the console
    console.log("Document Content:", fullText);

    const chunks = chunkText(fullText, 3000);
    const allRedactions = [];

    for (const chunk of chunks) {
        const response = await fetch("https://YOUR-BACKEND-URL.com/redact", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: chunk })
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
        const nextSpace = text.indexOf(' ', end);
        if (nextSpace !== -1) end = nextSpace;
        chunks.push(text.substring(start, end));
        start = end;
    }
    return chunks;
}

function highlightSnippets(spans, redactions) {
    redactions.forEach(({ snippet, type }) => {
        spans.forEach(span => {
            if (span.textContent.includes(snippet)) {
                span.style.backgroundColor = type === "PII" ? "#ffcccc" : "#ccffff";
            }
        });
    });
}

async function redactImagesWithAPI() {
    const images = Array.from(document.querySelectorAll("img"));

    for (const img of images) {
        try {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);

            const dataUrl = canvas.toDataURL("image/png");
            const base64Image = dataUrl.split(",")[1];

            const response = await fetch("https://YOUR-BACKEND-URL.com/redact-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image: base64Image }),
            });

            const result = await response.json();
            if (result.redactedImage) {
                img.src = `data:image/png;base64,${result.redactedImage}`;
            }
        } catch (err) {
            console.error("Image redaction failed:", err);
        }
    }
}