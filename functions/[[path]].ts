import { handleImageRequest } from "../src/lib/transform";

interface Env {
  ALLOWED_HOSTS?: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request } = context;

  // Fast path: image requests always carry a `url` param; everything else
  // falls straight through to the static asset cache.
  if (!request.url.includes("url=")) return context.next();

  const url = new URL(request.url);
  if (!url.searchParams.has("url")) return context.next();

  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: {
        allow: "GET, HEAD",
        "content-type": "text/plain; charset=utf-8",
      },
    });
  }

  try {
    return await handleImageRequest(
      url,
      request.headers.get("accept"),
      context.env.ALLOWED_HOSTS ?? "",
    );
  } catch {
    // Last-resort safety net: any unexpected failure still gets a clean error
    // response instead of an unhandled exception with a stack trace.
    return new Response("Internal error", {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
};
