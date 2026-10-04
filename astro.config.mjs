// @ts-check
import { defineConfig } from 'astro/config';

import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  image: {
      remotePatterns: [{ protocol: "https" }],
      domains: ["image.rapid-access.online"],
  },
  session: false,
  adapter: cloudflare(),
});