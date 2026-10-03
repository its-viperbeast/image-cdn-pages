import { afterEach, describe, expect, it, vi } from "vitest";
import { handleImageRequest } from "../src/lib/transform";

const ALLOWED_HOSTS = "images.example";

type FetchMock = ReturnType<typeof vi.fn<(url: string, init?: RequestInit) => Promise<Response>>>;

function call(query: string, accept: string | null = "image/webp") {
  return handleImageRequest(new URL(`https://cdn.example/?${query}`), accept, ALLOWED_HOSTS);
}

function imageOptions(fetchMock: FetchMock): RequestInitCfPropertiesImage {
  const init = fetchMock.mock.calls[0]?.[1];
  return (init?.cf as { image: RequestInitCfPropertiesImage }).image;
}

describe("handleImageRequest", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fetches the source with edge image resizing options", async () => {
    const upstream = new Response("optimized", {
      headers: { "content-type": "image/webp" },
    });
    const fetchMock: FetchMock = vi.fn(async () => upstream);
    vi.stubGlobal("fetch", fetchMock);

    const response = await call(
      "url=https://images.example/photo.jpg&w=800&h=600&fit=cover&q=80&output=webp",
    );

    expect(response).toBe(upstream);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://images.example/photo.jpg");
    expect(imageOptions(fetchMock)).toEqual({
      format: "webp",
      width: 800,
      height: 600,
      fit: "cover",
      quality: 80,
    });
  });

  it("negotiates the format from Accept when output is omitted", async () => {
    const fetchMock: FetchMock = vi.fn(async () => new Response("optimized"));
    vi.stubGlobal("fetch", fetchMock);

    await call("url=https://images.example/photo.jpg", "image/avif,image/webp");

    expect(imageOptions(fetchMock).format).toBe("avif");
  });

  it("maps upstream client errors to 400 and server errors to 502", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 404, statusText: "Not Found" })),
    );
    expect((await call("url=https://images.example/photo.jpg")).status).toBe(400);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("boom", { status: 500 })),
    );
    expect((await call("url=https://images.example/photo.jpg")).status).toBe(502);
  });

  it("rejects disallowed hosts before fetching", async () => {
    const fetchMock: FetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await call("url=https://evil.example/photo.jpg");

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
