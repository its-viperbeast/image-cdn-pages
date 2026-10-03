import { handlePagesRequest } from "../src/lib/transform";

interface Env {
  ALLOWED_HOSTS?: string;
  [key: string]: unknown;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  // Fast check: only handle image requests when query param "url" is present
  if (request.url.includes("url=")) {
    const url = new URL(request.url);
    if (url.searchParams.has("url")) {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: {
            allow: "GET, HEAD",
            "content-type": "text/plain; charset=utf-8",
          },
        });
      }
      return handlePagesRequest(request, env);
    }
  }

  // Otherwise, delegate directly to Cloudflare Pages static asset cache
  return await context.next();
};
