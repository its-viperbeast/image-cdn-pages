// @ts-check
import { defineConfig } from 'astro/config';

import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  output: "server",
  image: {
      remotePatterns: [{ protocol: "https" }],
      domains: ["image.rapid-access.online"],
      service: { entrypoint: "./src/image-service.ts" },
      endpoint: { entrypoint: "./src/image-endpoint.ts" },
  },
  session: false,
  adapter: cloudflare({
    imageService: "custom",
  }),
});