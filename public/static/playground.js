const form = document.querySelector("#optimizer");
const link = document.querySelector("#link");
const statusEl = document.querySelector("#status");
const preview = document.querySelector("#preview");

if (!form || !link || !statusEl || !preview) {
  throw new Error("Playground markup is incomplete");
}

const inputs = {
  url: document.querySelector("#url"),
  w: document.querySelector("#w"),
  h: document.querySelector("#h"),
  fit: document.querySelector("#fit"),
  q: document.querySelector("#q"),
  output: document.querySelector("#output"),
};

let previewUrl = "";

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const params = new URLSearchParams();
  for (const [key, el] of Object.entries(inputs)) {
    const val = el?.value?.trim();
    if (val) params.set(key, val);
  }

  const href = "/?" + params.toString();
  const absolute = new URL(href, location.origin).href;
  link.href = href;
  link.textContent = absolute;
  statusEl.textContent = "Fetching…";
  preview.hidden = true;
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = "";
  }

  try {
    const response = await fetch(href);
    if (!response.ok) {
      statusEl.textContent = (await response.text()) || "Request failed";
      return;
    }
    const blob = await response.blob();
    previewUrl = URL.createObjectURL(blob);
    preview.src = previewUrl;
    preview.hidden = false;
    const type = response.headers.get("content-type") || "image";
    statusEl.textContent = `${type} · ${(blob.size / 1024).toFixed(1)} KB (${blob.size.toLocaleString()} bytes)`;
  } catch {
    statusEl.textContent = "Could not reach the optimizer";
  }
});
