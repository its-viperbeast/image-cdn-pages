import type { APIRoute } from "astro";

export const prerender = false;

const FORMATS = new Set(["jpeg", "jpg", "png", "gif", "webp", "avif"]);
const FITS = new Set(["scale-down", "contain", "cover", "crop", "pad"]);

function text(message: string, status: number) {
	return new Response(message, {
		status,
		headers: {
			"content-type": "text/plain; charset=utf-8",
			"cache-control": "no-store",
		},
	});
}

function blockedHost(hostname: string) {
	const host = hostname.toLowerCase().replace(/\.$/, "");
	if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
	if (host === "metadata.google.internal" || host === "metadata.goog") return true;
	const match = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(host);
	if (!match) return false;
	const a = Number(match[1]);
	const b = Number(match[2]);
	if (a === 0 || a === 10 || a === 127) return true;
	if (a === 169 && b === 254) return true;
	if (a === 172 && b >= 16 && b <= 31) return true;
	if (a === 192 && b === 168) return true;
	return false;
}

function dimension(raw: string | null) {
	if (raw === null || raw.trim() === "") return undefined;
	if (!/^\d+$/.test(raw)) return "bad" as const;
	const value = Number(raw);
	if (value < 1 || value > 4096) return "bad" as const;
	return value;
}

export const GET: APIRoute = async ({ request }) => {
	const url = new URL(request.url);
	const href = url.searchParams.get("href");
	if (!href) return text("Missing href", 400);

	let source: URL;
	try {
		source = new URL(href);
	} catch {
		return text("Invalid href", 400);
	}
	if (source.protocol !== "https:" || source.username || source.password) {
		return text("Only https URLs are allowed", 400);
	}
	if (blockedHost(source.hostname) || source.hostname === url.hostname) {
		return text("Host is not allowed", 403);
	}

	const format = (url.searchParams.get("f") ?? "webp").toLowerCase();
	if (!FORMATS.has(format)) return text(`Unsupported format: ${format}`, 400);

	const width = dimension(url.searchParams.get("w"));
	const height = dimension(url.searchParams.get("h"));
	if (width === "bad" || height === "bad") return text("w and h must be positive integers", 400);

	const image: Record<string, string | number> = {
		format: format === "jpg" ? "jpeg" : format,
	};
	if (typeof width === "number") image.width = width;
	if (typeof height === "number") image.height = height;

	const fit = url.searchParams.get("fit");
	if (fit) {
		if (!FITS.has(fit)) return text("Invalid fit", 400);
		image.fit = fit;
	}

	const quality = url.searchParams.get("q");
	if (quality) {
		const parsed = Number(quality);
		if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
			return text("q must be an integer from 1 to 100", 400);
		}
		image.quality = parsed;
	}

	const response = await fetch(source, { cf: { image } } as RequestInit);
	if (!response.ok || !response.body) return text("Not Found", 404);

	const headers = new Headers();
	const type = response.headers.get("content-type");
	if (type) headers.set("content-type", type);
	headers.set("cache-control", "public, max-age=31536000, immutable");
	return new Response(response.body, { status: 200, headers });
};
