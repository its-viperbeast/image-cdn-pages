# img-cdn

On-the-fly image optimizer on [Astro](https://astro.build) + [Cloudflare Workers](https://developers.cloudflare.com/workers/).

```bash
npm install
npm run dev
```

Example CDN URL:

```txt
/?url=https://example.com/photo.jpg&w=800&h=600&fit=cover&q=80&output=webp
```

```bash
npm test
npm run build
npm run deploy
```

Set `ALLOWED_HOSTS` in `wrangler.jsonc` to a comma-separated host list, or leave empty to allow any public HTTPS origin.
