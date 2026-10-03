import { build } from "esbuild";
import { cp, readdir, rm } from "node:fs/promises";
import path from "node:path";

// Cloudflare Pages publishes `dist/` as static files and only runs a Worker
// when that directory contains `_worker.js`. Astro's Cloudflare adapter emits
// `dist/client` and `dist/server` for `wrangler deploy`, which Pages serves as
// files and never executes.
if (process.env.CF_PAGES !== "1") {
  process.exit(0);
}

const root = process.cwd();
const dist = path.join(root, "dist");
const clientDir = path.join(dist, "client");
const serverEntry = path.join(dist, "server", "entry.mjs");
const staging = path.join(root, ".pages-dist");

await rm(staging, { recursive: true, force: true });

await build({
  entryPoints: [serverEntry],
  bundle: true,
  format: "esm",
  platform: "neutral",
  outfile: path.join(staging, "_worker.js"),
  external: ["cloudflare:workers"],
  logLevel: "silent",
});

for (const name of await readdir(clientDir)) {
  await cp(path.join(clientDir, name), path.join(staging, name), { recursive: true });
}

await rm(dist, { recursive: true, force: true });
await cp(staging, dist, { recursive: true });
await rm(staging, { recursive: true, force: true });
