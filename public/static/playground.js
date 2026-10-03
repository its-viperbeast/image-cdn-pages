const form = document.querySelector("#optimizer");
const link = document.querySelector("#link");
const status = document.querySelector("#status");
const preview = document.querySelector("#preview");
let previewUrl = "";

if (!form || !link || !status || !preview) {
  throw new Error("Playground markup is incomplete");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const params = new URLSearchParams();
  for (const field of ["url", "w", "h", "fit", "q", "output"]) {
    const value = document.querySelector("#" + field).value.trim();
    if (value) params.set(field, value);
  }

  const href = "/?" + params.toString();
  const absolute = new URL(href, location.origin).href;
  link.href = href;
  link.textContent = absolute;
  status.textContent = "Fetching…";
  preview.hidden = true;
  if (previewUrl) URL.revokeObjectURL(previewUrl);

  try {
    const response = await fetch(href);
    if (!response.ok) {
      status.textContent = (await response.text()) || "Request failed";
      return;
    }
    const blob = await response.blob();
    previewUrl = URL.createObjectURL(blob);
    preview.src = previewUrl;
    preview.hidden = false;
    status.textContent = (response.headers.get("content-type") || "image") + " · " + blob.size + " bytes";
  } catch {
    status.textContent = "Could not reach the optimizer";
  }
});
