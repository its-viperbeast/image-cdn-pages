# img-cdn

On-the-fly image optimizer built for **[Cloudflare Pages](https://pages.cloudflare.com/)** + [Astro](https://astro.build).

## How it Works

- **Static Frontend**: Astro statically builds the interactive playground UI to `dist/`.
- **Edge Transformations**: Cloudflare Pages Functions (`functions/[[path]].ts`) handle on-the-fly image resizing and format negotiation via Cloudflare's edge Image Resizing and the `IMAGES` binding.
- **SSRF Protection**: Validates all source image URLs, strictly enforcing HTTPS, and blocks loopback, private IPv4/IPv6 ranges, link-local, and cloud metadata endpoints.
- **Origin Allowlist**: Optional allowlist via `ALLOWED_HOSTS` environment variable.

## Development

```bash
npm install
npm test
npm run dev
```

The dev server starts on `http://localhost:8788`.

## Cloudflare Pages Deployment

### Option 1: Git Integration (Recommended)
Connect your repository in the Cloudflare Pages dashboard:
- **Framework preset**: `Astro` (or `None`)
- **Build command**: `npm run build`
- **Build output directory**: `dist`
- **Node.js version**: `22` (automatically set via `.nvmrc`)

### Option 2: Wrangler CLI
```bash
npm run deploy
```

## Example CDN URL

```txt
/?url=https://example.com/photo.jpg&w=800&h=600&fit=cover&q=80&output=webp
```

### Supported Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `url` | URL (required) | Public HTTPS image URL |
| `w` | integer (1–4096) | Target width |
| `h` | integer (1–4096) | Target height |
| `fit` | string | `contain`, `cover`, `scale-down`, `inside` |
| `q` | integer (1–100) | Image quality |
| `output` | string | Output format (`jpg`, `png`, `webp`, `avif`, or auto-negotiated from `Accept`) |

## Environment Variables

Configure in `wrangler.jsonc` or Cloudflare Pages dashboard:
- `ALLOWED_HOSTS`: Comma-separated list of allowed hostnames (leave empty to allow any public HTTPS origin).
