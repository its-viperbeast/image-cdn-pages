import { describe, expect, it, vi } from "vitest";
import { handleImageRequest } from "../src/lib/transform";

const context = {
  origin: "https://cdn.example",
  allowedHosts: "images.example",
  serviceHost: "cdn.example",
};

describe("handleImageRequest", () => {
  it("rewrites directly to Astro's native image endpoint", async () => {
    const nativeResponse = new Response("optimized", {
      headers: { "content-type": "image/webp" },
    });
    const rewrite = vi.fn(async () => nativeResponse);

    const response = await handleImageRequest(
      new URLSearchParams(
        "url=https://images.example/photo.jpg&w=800&h=600&fit=cover&q=80&output=webp",
      ),
      "image/webp",
      context,
      rewrite,
    );

    expect(response).toBe(nativeResponse);
    expect(rewrite).toHaveBeenCalledOnce();
    const url = rewrite.mock.calls[0]?.[0];
    expect(url?.pathname).toBe("/_image");
    expect(Object.fromEntries(url?.searchParams ?? [])).toEqual({
      href: "https://images.example/photo.jpg",
      w: "800",
      h: "600",
      fit: "cover",
      q: "80",
      f: "webp",
    });
  });

  it("preserves streaming and varies negotiated formats by Accept", async () => {
    const rewrite = vi.fn(async () =>
      new Response("optimized", {
        headers: {
          "content-type": "image/avif",
          vary: "Origin",
        },
      }),
    );

    const response = await handleImageRequest(
      new URLSearchParams("url=https://images.example/photo.jpg"),
      "image/avif,image/webp",
      context,
      rewrite,
    );

    expect(response.headers.get("vary")).toBe("Origin, Accept");
    expect(await response.text()).toBe("optimized");
  });

  it("rejects blocked hosts before invoking the image endpoint", async () => {
    const rewrite = vi.fn(async () => new Response("should not run"));

    const response = await handleImageRequest(
      new URLSearchParams("url=https://evil.example/photo.jpg"),
      "image/webp",
      context,
      rewrite,
    );

    expect(response.status).toBe(403);
    expect(rewrite).not.toHaveBeenCalled();
  });
});
