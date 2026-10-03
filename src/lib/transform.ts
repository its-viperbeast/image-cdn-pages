import { checkSourceUrl } from "./fetch-image";
import { parseImageParams, type ImageParams, type OutputFormat } from "./params";

const FORMAT_SHORT: Record<OutputFormat, "jpeg" | "png" | "webp" | "avif"> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

function plainText(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

function fetchImage(params: ImageParams): Promise<Response> {
  const image: RequestInitCfPropertiesImage = { format: FORMAT_SHORT[params.format] };
  if (params.width) image.width = params.width;
  if (params.height) image.height = params.height;
  if (params.fit) image.fit = params.fit;
  if (params.quality) image.quality = params.quality;

  return fetch(params.sourceUrl, {
    headers: {
      "user-agent": "img-cdn/1.0",
      accept: "image/*,*/*;q=0.8",
    },
    cf: { image },
  });
}

export async function handleImageRequest(
  url: URL,
  accept: string | null,
  allowedHosts: string,
): Promise<Response> {
  const parsed = parseImageParams(url.searchParams, accept);
  if (!parsed.ok) return plainText(parsed.message, parsed.status);

  const validation = checkSourceUrl(parsed.params.sourceUrl, allowedHosts, url.hostname);
  if (!validation.ok) return plainText(validation.message, validation.status);

  const res = await fetchImage(parsed.params);
  if (!res.ok) {
    return plainText(
      `Failed to fetch source image: ${res.statusText || res.status}`,
      res.status >= 400 && res.status < 500 ? 400 : 502,
    );
  }

  // Stream the optimized image straight through, untouched.
  return res;
}
