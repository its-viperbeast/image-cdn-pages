# img-cdn

A blazing-fast, headless, on-the-fly image optimization CDN powered by **[Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/)** and **Cloudflare Edge Image Resizing** (`cf.image`).

No frontend overhead. No build step. Pure edge performance with zero cold start.

---

## Features

- **⚡ Blazing Fast**: Processes and streams images directly at Cloudflare edge locations worldwide.
- **🖼️ Smart Format Negotiation**: Automatically delivers modern formats (`image/avif`, `image/webp`) based on the client's `Accept` header.
- **🔒 Enterprise SSRF Protection**:
  - Enforces strict `https://` protocol.
  - Strips and rejects embedded credentials (`user:pass@`).
  - Blocks loopback (`127.0.0.1`, `localhost`), link-local, private IPv4 (RFC 1918), and private IPv6 (ULA/link-local/IPv4-mapped) addresses.
  - Blocks cloud provider metadata endpoints (`metadata.google.internal`, etc.).
  - Prevents recursive request loops to itself.
- **🛡️ Domain Whitelist (Optional)**: Restrict optimization to specific origins via `ALLOWED_HOSTS`.
- **🚀 Zero-Build Architecture**: Runs directly on Cloudflare Pages without compiling frontend frameworks or bundlers.

---

## Quick Start & Usage

Construct the image URL by passing the source image and transformation parameters as query strings to your CDN domain:

```txt
https://<your-cdn-domain>/?url=<SOURCE_IMAGE_URL>&w=<WIDTH>&h=<HEIGHT>&fit=<FIT>&q=<QUALITY>&output=<FORMAT>
```

### Example Requests

#### 1. Basic Resize
Resize to 800px width (aspect ratio preserved):
```txt
https://cdn.example.com/?url=https://images.unsplash.com/photo-1579783900882-c0d3dad7b119&w=800
```

#### 2. Square Thumbnail with Cover Fit
Crop and center to a 400x400 square:
```txt
https://cdn.example.com/?url=https://images.unsplash.com/photo-1579783900882-c0d3dad7b119&w=400&h=400&fit=cover
```

#### 3. Automatic Format Negotiation (Recommended)
Omit `output` to automatically serve **AVIF** to supported browsers, fallback to **WebP**, and fallback to **JPEG**:
```txt
https://cdn.example.com/?url=https://images.unsplash.com/photo-1579783900882-c0d3dad7b119&w=1200
```

#### 4. Explicit Format & Quality
Convert to WebP with 80% quality:
```txt
https://cdn.example.com/?url=https://images.unsplash.com/photo-1579783900882-c0d3dad7b119&w=1024&output=webp&q=80
```

#### 5. Scale Down Without Upscaling
Scale down to max 600px width without stretching images smaller than 600px:
```txt
https://cdn.example.com/?url=https://images.unsplash.com/photo-1579783900882-c0d3dad7b119&w=600&fit=scale-down
```

---

## Query Parameters Reference

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `url` | `string` | **Yes** | — | Absolute public `https://` URL of the source image. |
| `w` | `integer` | No | Original | Target width in pixels (`1` to `4096`). Values exceeding 4096 are clamped to 4096. |
| `h` | `integer` | No | Original | Target height in pixels (`1` to `4096`). Values exceeding 4096 are clamped to 4096. |
| `fit` | `string` | No | `contain` | Resize fit mode: `contain`, `cover`, `scale-down`, or `inside` (alias for `contain`). |
| `q` | `integer` | No | `85` | Compression quality from `1` (lowest size) to `100` (highest quality). |
| `output` | `string` | No | Auto | Target format: `jpg`, `jpeg`, `png`, `webp`, or `avif`. If omitted, negotiated automatically via `Accept`. |

### Fit Modes Explained

- `contain` (or `inside`): Resizes image to fit completely within the given width and height while maintaining aspect ratio.
- `cover`: Resizes and crops the image to fill the exact dimensions without distortion.
- `scale-down`: Similar to `contain`, but never upscales if the source image is already smaller than the specified dimensions.

---

## Configuration & Environment Variables

Configure environment variables in `wrangler.jsonc` or in the Cloudflare Pages project settings:

| Variable | Description | Default |
|----------|-------------|---------|
| `ALLOWED_HOSTS` | Comma-separated list of allowed hostnames (e.g. `images.example.com, cdn.mysite.com`). If left empty, all public HTTPS origins are permitted. | `""` (allow all public hosts) |

### Example `wrangler.jsonc`:
```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "img-cdn",
  "compatibility_date": "2026-10-03",
  "pages_build_output_dir": "./public",
  "vars": {
    "ALLOWED_HOSTS": "images.unsplash.com, cdn.mysite.com"
  }
}
```

---

## Local Development

Requirements: **Node.js >= 22.12.0**

```bash
# 1. Install dependencies
npm install

# 2. Start the local development server
npm run dev
```

The server starts locally at `http://127.0.0.1:8788`.

You can test requests using `curl` or your browser:

```bash
# Get service usage instructions
curl http://127.0.0.1:8788/

# Test an image transformation
curl -i "http://127.0.0.1:8788/?url=https://images.unsplash.com/photo-1579783900882-c0d3dad7b119&w=400&output=webp"
```

---

## Deployment to Cloudflare Pages

### Option 1: Git Integration (Recommended)
1. Push your repository to GitHub or GitLab.
2. In the [Cloudflare Dashboard](https://dash.cloudflare.com/), go to **Compute (Workers) > Pages > Connect to Git**.
3. Select your repository and configure:
   - **Framework preset**: `None`
   - **Build command**: *(leave blank)*
   - **Build output directory**: `public`
4. Deploy! Cloudflare Pages automatically compiles and serves `functions/[[path]].ts`.

### Option 2: Wrangler CLI
Deploy directly from your terminal:
```bash
npm run deploy
```

> **Note**: Cloudflare Edge Image Resizing requires a Cloudflare Pro, Business, or Enterprise zone or Workers Paid plan with Image Resizing enabled.

---

## HTTP Status Codes

| Status Code | Description |
|-------------|-------------|
| `200 OK` | Image transformed and returned successfully, or root usage guide displayed. |
| `400 Bad Request` | Missing `url` parameter, invalid dimensions, unsupported format, or non-HTTPS URL. |
| `403 Forbidden` | Target host is blocked (private IP, loopback, metadata service, or not in `ALLOWED_HOSTS`). |
| `405 Method Not Allowed` | Requests using HTTP methods other than `GET` or `HEAD`. |
| `502 Bad Gateway` | Upstream origin server failed to return the source image. |

---

## License

MIT
