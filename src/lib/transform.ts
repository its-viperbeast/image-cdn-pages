import { checkSourceUrl } from "./fetch-image";
import { parseImageParams, type ImageParams, type OutputFormat } from "./params";

const IMAGE_ENDPOINT = "/_image";

export type TransformContext = {
  origin: string;
  allowedHosts: string;
  serviceHost: string;
  env?: {
    ALLOWED_HOSTS?: string;
    [key: string]: unknown;
  };
};

export type ImageFetcher = (url: URL, params: ImageParams) => Promise<Response>;

function plainText(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export function buildNativeImageUrl(origin: string, params: ImageParams): URL {
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

async function defaultImageFetcher(
  _targetUrl: URL,
  params: ImageParams,
  _ctx: TransformContext,
): Promise<Response> {
  const formatShort = formatParam(params.format);
  const cfImage: Record<string, unknown> = {
    format: formatShort,
  };
  if (params.width) cfImage.width = params.width;
  if (params.height) cfImage.height = params.height;
  if (params.fit) cfImage.fit = params.fit;
  if (params.quality) cfImage.quality = params.quality;

  const res = await fetch(params.sourceUrl, {
    headers: {
      "user-agent": "img-cdn/1.0",
      accept: "image/*,*/*;q=0.8",
    },
    cf: {
      image: cfImage,
    },
  });

  if (!res.ok) {
    return plainText(
      `Failed to fetch source image: ${res.statusText || res.status}`,
      res.status >= 400 && res.status < 500 ? 400 : 502,
    );
  }

  return res;
}

export async function handleImageRequest(
  searchParams: URLSearchParams,
  accept: string | null,
  ctx: TransformContext,
  fetcher?: ImageFetcher,
): Promise<Response> {
  const parsed = parseImageParams(searchParams, accept);
  if (!parsed.ok) return plainText(parsed.message, parsed.status);

  const validation = checkSourceUrl(parsed.params.sourceUrl, ctx.allowedHosts, ctx.serviceHost);
  if (!validation.ok) return plainText(validation.message, validation.status);

  const targetUrl = buildNativeImageUrl(ctx.origin, parsed.params);
  const response = fetcher
    ? await fetcher(targetUrl, parsed.params)
    : await defaultImageFetcher(targetUrl, parsed.params, ctx);

  if (!parsed.params.negotiated && fetcher) return response;

  const headers = new Headers(response.headers);
  if (parsed.params.negotiated) {
    headers.set("Vary", appendVary(headers.get("Vary"), "Accept"));
  }
  if (!headers.has("Cache-Control")) {
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function handlePagesRequest(
  request: Request,
  env: { ALLOWED_HOSTS?: string; [key: string]: unknown },
): Promise<Response> {
  const url = new URL(request.url);
  return handleImageRequest(
    url.searchParams,
    request.headers.get("accept"),
    {
      origin: url.origin,
      allowedHosts: env.ALLOWED_HOSTS ?? "",
      serviceHost: url.hostname,
      env,
    },
  );
}

function appendVary(current: string | null, value: string): string {
  if (!current) return value;
  const values = current.split(",").map((entry) => entry.trim());
  return values.some((entry) => entry.toLowerCase() === value.toLowerCase())
    ? current
    : `${current}, ${value}`;
}
