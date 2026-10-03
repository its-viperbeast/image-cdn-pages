import { checkSourceUrl } from "./fetch-image";
import { parseImageParams, type ImageParams, type OutputFormat } from "./params";

const IMAGE_ENDPOINT = "/_image";

type TransformContext = {
  origin: string;
  allowedHosts: string;
  serviceHost: string;
};

type RewriteImageRequest = (url: URL) => Promise<Response>;

function plainText(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function buildNativeImageUrl(origin: string, params: ImageParams): URL {
  const url = new URL(IMAGE_ENDPOINT, origin);
  url.searchParams.set("href", params.sourceUrl);
  if (params.width !== undefined) url.searchParams.set("w", String(params.width));
  if (params.height !== undefined) url.searchParams.set("h", String(params.height));
  if (params.fit !== undefined) url.searchParams.set("fit", params.fit);
  if (params.quality !== undefined) url.searchParams.set("q", String(params.quality));
  url.searchParams.set("f", formatParam(params.format));
  return url;
}

function formatParam(format: OutputFormat): string {
  switch (format) {
    case "image/jpeg":
      return "jpeg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/avif":
      return "avif";
  }
}

export async function handleImageRequest(
  searchParams: URLSearchParams,
  accept: string | null,
  ctx: TransformContext,
  rewrite: RewriteImageRequest,
): Promise<Response> {
  const parsed = parseImageParams(searchParams, accept);
  if (!parsed.ok) return plainText(parsed.message, parsed.status);

  const validation = checkSourceUrl(parsed.params.sourceUrl, ctx.allowedHosts, ctx.serviceHost);
  if (!validation.ok) return plainText(validation.message, validation.status);

  const response = await rewrite(buildNativeImageUrl(ctx.origin, parsed.params));
  if (!parsed.params.negotiated) return response;

  const headers = new Headers(response.headers);
  headers.set("Vary", appendVary(headers.get("Vary"), "Accept"));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function appendVary(current: string | null, value: string): string {
  if (!current) return value;
  const values = current.split(",").map((entry) => entry.trim());
  return values.some((entry) => entry.toLowerCase() === value.toLowerCase())
    ? current
    : `${current}, ${value}`;
}
