import { build } from "esbuild";
import { cp, readdir, rm } from "node:fs/promises";
import path from "node:path";

/**
 * Restructure Astro's Cloudflare adapter output for Cloudflare Pages.
 *
 * The adapter emits dist/client (static assets) + dist/server (worker entry)
 * which is the layout `wrangler deploy` expects. Cloudflare Pages instead
 * needs a flat directory with _worker.js at the root alongside the static
 * files.
 *
 * This script also shims `cloudflare:workers` because Pages doesn't support
 * that bare specifier — bindings are passed via the fetch handler's `env`
 * argument instead.
 *
 * Only runs when CF_PAGES=1 (set automatically by Cloudflare Pages builds).
 * This makes it safe to include in the default `build` script without
 * breaking `wrangler deploy`.
 */

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
  stdin: {
    contents: `
      import worker from ${JSON.stringify(serverEntry)};
      export default {
        fetch(request, env, context) {
          globalThis.__CF_ENV = env;
          return worker.fetch(request, env, context);
        },
      };
    `,
    resolveDir: path.dirname(serverEntry),
    sourcefile: "pages-worker-entry.mjs",
  },
  bundle: true,
  format: "esm",
  platform: "neutral",
  outfile: path.join(staging, "_worker.js"),
  logLevel: "silent",
  plugins: [
    {
      name: "cloudflare-workers-shim",
      setup(build) {
        // Intercept `import { env } from "cloudflare:workers"` and provide
        // a proxy that reads bindings from the fetch handler's `env` arg,
        // which we stash on globalThis.__CF_ENV.
        build.onResolve({ filter: /^cloudflare:workers$/ }, () => ({
          path: "cloudflare:workers",
          namespace: "cloudflare-workers-shim",
        }));
        build.onLoad({ filter: /.*/, namespace: "cloudflare-workers-shim" }, () => ({
          contents: `
            export const env = new Proxy({}, {
              get(_target, key) {
                const bindings = globalThis.__CF_ENV;
                if (!bindings) return undefined;
                return bindings[key];
              },
            });
          `,
          loader: "js",
        }));
      },
    },
  ],
});

// Copy all static assets from dist/client into the staging directory
for (const name of await readdir(clientDir)) {
  await cp(path.join(clientDir, name), path.join(staging, name), { recursive: true });
}

// Replace dist/ with the Pages-compatible flat layout
await rm(dist, { recursive: true, force: true });
await cp(staging, dist, { recursive: true });
await rm(staging, { recursive: true, force: true });

console.log("✓ Prepared Pages-compatible output in dist/");
