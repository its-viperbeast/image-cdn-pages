export const MAX_EDGE = 4096;

export type FitMode = "contain" | "cover" | "scale-down";

export type OutputFormat = "image/jpeg" | "image/png" | "image/webp" | "image/avif";

export type ImageParams = {
  sourceUrl: string;
  width?: number;
  height?: number;
  fit?: FitMode;
  quality?: number;
  format: OutputFormat;
  negotiated: boolean;
};

export type ParamResult =
  | { ok: true; params: ImageParams }
  | { ok: false; status: number; message: string };

const OUTPUT_FORMATS: Readonly<Record<string, OutputFormat>> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
};

const FIT_MODES = new Set<FitMode>(["contain", "cover", "scale-down"]);

export function parseImageParams(
  searchParams: URLSearchParams,
  accept: string | null,
): ParamResult {
  const sourceUrl = searchParams.get("url")?.trim();
  if (!sourceUrl) {
    return { ok: false, status: 400, message: "Missing url" };
  }

  const width = parseDimension(searchParams.get("w"), "w");
  if (width && !width.ok) return width;

  const height = parseDimension(searchParams.get("h"), "h");
  if (height && !height.ok) return height;

  const fit = parseFit(searchParams.get("fit"));
  if (fit && !fit.ok) return fit;

  const quality = parseQuality(searchParams.get("q"));
  if (quality && !quality.ok) return quality;

  const format = parseFormat(searchParams.get("output"), accept);
  if (!format.ok) return format;

  return {
    ok: true,
    params: {
      sourceUrl,
      width: width?.value,
      height: height?.value,
      fit: fit?.value,
      quality: quality?.value,
      format: format.format,
      negotiated: format.negotiated,
    },
  };
}

function formatFromAccept(accept: string | null): OutputFormat {
  if (!accept) return "image/jpeg";
  const header = accept.toLowerCase();
  if (header.includes("image/avif")) return "image/avif";
  if (header.includes("image/webp")) return "image/webp";
  return "image/jpeg";
}

function parseDimension(
  raw: string | null,
  name: "w" | "h",
): { ok: true; value: number } | { ok: false; status: number; message: string } | undefined {
  if (!raw) return undefined;
  const str = raw.trim();
  if (!str) return undefined;
  if (!/^\d+$/.test(str)) {
    return { ok: false, status: 400, message: `${name} must be a positive integer` };
  }
  const value = Number(str);
  if (!Number.isInteger(value) || value < 1) {
    return { ok: false, status: 400, message: `${name} must be a positive integer` };
  }
  return { ok: true, value: value > MAX_EDGE ? MAX_EDGE : value };
}

function parseFit(
  raw: string | null,
): { ok: true; value: FitMode } | { ok: false; status: number; message: string } | undefined {
  if (!raw) return undefined;
  const str = raw.trim().toLowerCase();
  if (!str) return undefined;
  const value = str === "inside" ? "contain" : str;
  if (!FIT_MODES.has(value as FitMode)) {
    return {
      ok: false,
      status: 400,
      message: "fit must be contain, cover, scale-down, or inside",
    };
  }
  return { ok: true, value: value as FitMode };
}

function parseQuality(
  raw: string | null,
): { ok: true; value: number } | { ok: false; status: number; message: string } | undefined {
  if (!raw) return undefined;
  const str = raw.trim();
  if (!str) return undefined;
  if (!/^\d+$/.test(str)) {
    return { ok: false, status: 400, message: "q must be an integer from 1 to 100" };
  }
  const value = Number(str);
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    return { ok: false, status: 400, message: "q must be an integer from 1 to 100" };
  }
  return { ok: true, value };
}

function parseFormat(
  raw: string | null,
  accept: string | null,
): { ok: true; format: OutputFormat; negotiated: boolean } | { ok: false; status: number; message: string } {
  if (!raw) {
    return { ok: true, format: formatFromAccept(accept), negotiated: true };
  }
  const str = raw.trim().toLowerCase();
  if (!str) {
    return { ok: true, format: formatFromAccept(accept), negotiated: true };
  }
  const format = OUTPUT_FORMATS[str];
  if (!format) {
    return { ok: false, status: 400, message: "output must be jpg, png, webp, or avif" };
  }
  return { ok: true, format, negotiated: false };
}
