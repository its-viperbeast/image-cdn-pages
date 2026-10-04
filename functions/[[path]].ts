import { handleImageRequest } from "../src/lib/transform";

interface Env {
  ALLOWED_HOSTS?: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request } = context;

  // Let static files (e.g. robots.txt) pass through
  const url = new URL(request.url);
  if (url.pathname === "/robots.txt") {
    return context.next();
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: {
        allow: "GET, HEAD",
        "content-type": "text/plain; charset=utf-8",
      },
    });
  }

  // Return usage instructions if 'url' query param is missing
  if (!url.searchParams.has("url")) {
    return new Response(
      "img-cdn: On-the-fly Image Optimization Service\n\n" +
        "Usage:\n" +
        "  GET /?url=<image-url>&w=<width>&h=<height>&fit=<fit>&q=<quality>&output=<format>\n\n" +
        "Parameters:\n" +
        "  url     (required) Public HTTPS image URL\n" +
        "  w       (optional) Width in pixels (1-4096)\n" +
        "  h       (optional) Height in pixels (1-4096)\n" +
        "  fit     (optional) contain | cover | scale-down | inside (default: contain)\n" +
        "  q       (optional) Quality 1-100 (default: 85)\n" +
        "  output  (optional) jpg | png | webp | avif (default: auto via Accept header)\n",
      {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8" },
      },
    );
  }

  return handleImageRequest(url, request.headers.get("accept"), context.env.ALLOWED_HOSTS ?? "");
};
