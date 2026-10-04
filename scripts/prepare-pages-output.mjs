import { build } from "esbuild";
import { writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Cloudflare Pages only executes a script when the published directory
 * contains `_worker.js`. Astro's Cloudflare adapter writes the server to
 * `dist/server` for `wrangler deploy`. This bundles that Astro server into
 * `dist/client/_worker.js` so the Pages build can run `/_image`.
 *
 * Runs only when Cloudflare Pages sets CF_PAGES=1.
 */
if (process.env.CF_PAGES !== "1") {
	process.exit(0);
}

const root = process.cwd();
const clientDir = path.join(root, "dist", "client");
const serverDir = path.join(root, "dist", "server");
const serverEntry = path.join(serverDir, "entry.mjs");
const wrapper = path.join(serverDir, "_pages-entry.mjs");

await writeFile(
	wrapper,
	`import worker from "./entry.mjs";
export default {
  fetch(request, env, context) {
    globalThis.__CF_ENV = env;
    return worker.fetch(request, env, context);
  },
};
`,
);

await build({
	entryPoints: [wrapper],
	bundle: true,
	format: "esm",
	platform: "neutral",
	outfile: path.join(clientDir, "_worker.js"),
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

console.log("Prepared dist/client/_worker.js for Cloudflare Pages");
