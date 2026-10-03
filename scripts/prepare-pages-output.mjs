import { build } from "esbuild";
import { cp, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Cloudflare Pages publishes `dist/` as static files and only runs a Worker
// when that directory contains `_worker.js`. Astro's Cloudflare adapter emits
// `dist/client` and `dist/server` for `wrangler deploy`, which Pages serves as
// files and never executes. Pages also fails the deploy if that worker imports
// `cloudflare:workers`, so the binding object is read from the fetch handler.
export async function preparePagesOutput() {
  if (process.env.CF_PAGES !== "1") return;

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

  for (const name of await readdir(clientDir)) {
    await cp(path.join(clientDir, name), path.join(staging, name), { recursive: true });
  }

  await rm(dist, { recursive: true, force: true });
  await cp(staging, dist, { recursive: true });
  await rm(staging, { recursive: true, force: true });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await preparePagesOutput();
}
