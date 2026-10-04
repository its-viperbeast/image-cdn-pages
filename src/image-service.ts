import type { LocalImageService } from "astro";
import { baseService } from "astro/assets";

const service: LocalImageService = {
	...baseService,
	getURL(options) {
		const params = new URLSearchParams();
		const src = typeof options.src === "string" ? options.src : options.src.src;
		params.set("href", src);
		if (options.width) params.set("w", String(options.width));
		if (options.height) params.set("h", String(options.height));
		if (options.format) params.set("f", String(options.format));
		return `/_image?${params}`;
	},
	parseURL(url) {
		const params = url.searchParams;
		const width = params.get("w");
		const height = params.get("h");
		return {
			src: params.get("href") ?? "",
			width: width ? Number(width) : undefined,
			height: height ? Number(height) : undefined,
			format: params.get("f") ?? undefined,
		};
	},
	async transform(inputBuffer, transform) {
		return { data: inputBuffer, format: transform.format ?? "webp" };
	},
};

export default service;
