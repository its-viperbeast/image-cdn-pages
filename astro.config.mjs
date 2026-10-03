// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  output: "server",
  session: false,
  image: {
    remotePatterns: [{ protocol: "https" }],
  },
  adapter: cloudflare(),
  integrations: [
    {
      name: "pages-output",
      hooks: {
        "astro:build:done": async () => {
          const { preparePagesOutput } = await import("./scripts/prepare-pages-output.mjs");
          await preparePagesOutput();
        },
      },
    },
  ],
});
