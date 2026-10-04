# img-cdn

A minimal image CDN that resizes and re-encodes images on the fly, running entirely on [Cloudflare Pages](https://pages.cloudflare.com/). Point it at any public HTTPS image, add a few query parameters, and get an optimized image streamed back from Cloudflare's edge.

There is no frontend, no database, and no build step — the whole service is a single Pages Function.

## How it works

1. Every request hits the catch-all Pages Function in `functions/[[path]].ts`.
2. Requests **without** a `url` query parameter fall through to static assets — the home page is a static "Restricted / not allowed" notice (`public/index.html`).
3. The source URL is checked for SSRF safety (`src/lib/fetch-image.ts`) and the query parameters are validated (`src/lib/params.ts`).
4. The image is fetched with Cloudflare's [`cf.image`](https://developers.cloudflare.com/images/transformations/transform-url/) options (`src/lib/transform.ts`), so resizing and re-encoding happen at the edge.
5. The optimized image is streamed straight back to the client.

## Project structure

```txt
functions/[[path]].ts   Catch-all Pages Function (entry point)
src/lib/params.ts       Query-parameter parsing and validation
src/lib/fetch-image.ts  SSRF protection and host allowlist
src/lib/transform.ts    Edge fetch with image transform options
public/index.html       Static home page ("Restricted / not allowed" notice)
public/favicon.ico      Favicon
wrangler.jsonc          Cloudflare Pages configuration
```

## Requirements

- Node.js ≥ 22.12 (see `.nvmrc`)
- A Cloudflare account with **Image Resizing** available (the service uses the `cf.image` fetch option — see the [Cloudflare Images docs](https://developers.cloudflare.com/images/) for plan requirements)

## Local development

```bash
npm install
npm run dev
```

The dev server starts on <http://localhost:8788>.

> **Note:** parameter validation and SSRF checks run locally, but the image transformation itself only happens on Cloudflare's edge. In local dev the source image is fetched but returned untransformed.

## Usage

Send a `GET` (or `HEAD`) request with the source image URL as the `url` query parameter:

```txt
https://<your-domain>/?url=<source image URL>&w=800&h=600&fit=cover&q=80&output=webp
```

Always URL-encode the `url` value when it contains `&`, `?`, or `#` (e.g. `https%3A%2F%2Fexample.com%2Fphoto.jpg`).

### Parameters

| Parameter | Required | Values                                      | Default | Description                                          |
| --------- | -------- | ------------------------------------------- | ------- | ---------------------------------------------------- |
| `url`     | Yes      | HTTPS URL                                   | —       | Public HTTPS URL of the source image                 |
| `w`       | No       | 1–4096                                      | —       | Target width in pixels (larger values are clamped)   |
| `h`       | No       | 1–4096                                      | —       | Target height in pixels (larger values are clamped)  |
| `fit`     | No       | `contain`, `cover`, `scale-down`, `inside`  | —       | Fit mode; `inside` is accepted as an alias of `contain` |
| `q`       | No       | 1–100                                       | —       | Encoder quality                                      |
| `output`  | No       | `jpg`, `jpeg`, `png`, `webp`, `avif`         | Auto    | Output format                                        |

**Format negotiation:** when `output` is omitted, the format is picked from the client's `Accept` header — AVIF if supported, else WebP, else JPEG.

### Examples

Resize to an 800px-wide WebP and save it to disk:

```bash
curl -o photo.webp \
  "https://img-cdn.pages.dev/?url=https%3A%2F%2Fexample.com%2Fphoto.jpg&w=800&output=webp"
```

Use it directly in HTML (the best format is negotiated per browser):

```html
<img
  src="https://img-cdn.pages.dev/?url=https%3A%2F%2Fexample.com%2Fphoto.jpg&w=800&h=600&fit=cover&q=80"
  alt="A photo"
  width="800"
  height="600"
/>
```

Crop to a 300×300 JPEG thumbnail:

```txt
https://img-cdn.pages.dev/?url=https%3A%2F%2Fexample.com%2Fphoto.jpg&w=300&h=300&fit=cover&output=jpg
```

### Responses and errors

| Status | Meaning                                                                                                                        |
| ------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `200`  | Optimized image (content type matches the requested or negotiated format)                                                      |
| `400`  | Missing/invalid `url`, non-HTTPS source, credentials in the URL, source points at the CDN itself, invalid `w`/`h`/`fit`/`q`/`output`, or the origin returned a 4xx |
| `403`  | Source host is blocked (private/loopback/metadata address) or not in `ALLOWED_HOSTS`                                           |
| `405`  | Request method is not `GET` or `HEAD`                                                                                          |
| `502`  | Origin returned a 5xx or another unexpected status                                                                              |

## Security

The CDN proxies images only, never arbitrary requests:

- **HTTPS only** — `http://` sources are rejected, as are URLs with embedded credentials.
- **No loops** — URLs that point back at the CDN itself are rejected.
- **SSRF protection** — blocked destinations include `localhost` / `*.localhost` / `*.local`, cloud metadata endpoints (`metadata.google.internal`), dotless hostnames, and all private/reserved IP space:
  - IPv4: `0.0.0.0/8`, `10.0.0.0/8`, `127.0.0.0/8`, `169.254.0.0/16`, `172.16.0.0/12`, `192.168.0.0/16`, `100.64.0.0/10`, `255.255.255.255`
  - IPv6: `::`, `::1`, IPv4-mapped addresses, `fc00::/7`, `fe80::/10`
  - Alternative notations are decoded first, so tricks like `2130706433`, `0x7f000001`, or `0177.0.0.1` are blocked too.
- **Optional allowlist** — set `ALLOWED_HOSTS` to restrict sources to specific hostnames.

## Configuration

### `ALLOWED_HOSTS`

Comma-separated list of hostnames the CDN may fetch from. Leave it empty (default) to allow any public HTTPS origin. Matching is exact (no wildcards) and case-insensitive.

```jsonc
// wrangler.jsonc — applies to local dev and `wrangler pages deploy`
{
  "vars": {
    "ALLOWED_HOSTS": "images.example.com, cdn.example.net"
  }
}
```

If you deploy via the Pages **Git integration**, set `ALLOWED_HOSTS` in the dashboard under **Settings → Variables and Secrets** instead.

## Deployment

### Option 1 — Wrangler CLI

```bash
npm run deploy
```

This uploads `public/` (static assets) and `functions/` as the Pages project `img-cdn` (the `name` in `wrangler.jsonc`). On the first run Wrangler creates the project and prints the production URL, e.g. `https://img-cdn.pages.dev`.

In CI, provide `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as environment variables.

### Option 2 — Pages Git integration

Connect the repository in the Cloudflare Pages dashboard:

| Setting                   | Value                                            |
| ------------------------- | ------------------------------------------------ |
| Framework preset          | None                                             |
| Build command             | *(leave empty — there is nothing to build)*      |
| Build output directory    | `public`                                         |
| Node.js version           | 22 (picked up automatically from `.nvmrc`)       |

Pages bundles `functions/` automatically on every deploy.

## npm scripts

| Command           | Description                                  |
| ----------------- | -------------------------------------------- |
| `npm run dev`     | Start the local dev server on `localhost:8788` |
| `npm run deploy`  | Deploy to Cloudflare Pages                    |
| `npm run typecheck` | Type-check `functions/` and `src/`          |