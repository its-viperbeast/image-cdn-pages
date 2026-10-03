import { describe, expect, it } from "vitest";
import {
  checkSourceUrl,
  isBlockedHost,
  isHostAllowed,
} from "../src/lib/fetch-image";
import { MAX_EDGE, parseImageParams } from "../src/lib/params";

function params(query: string, accept: string | null = null) {
  return parseImageParams(new URLSearchParams(query), accept);
}

describe("parseImageParams", () => {
  it("requires a url", () => {
    expect(params("w=100")).toEqual({ ok: false, status: 400, message: "Missing url" });
  });

  it("clamps edges above 4096", () => {
    const result = params("url=https://cdn.example/a.jpg&w=9000&h=4096");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.params.width).toBe(MAX_EDGE);
    expect(result.params.height).toBe(4096);
  });

  it("rejects non-positive dimensions", () => {
    expect(params("url=https://cdn.example/a.jpg&w=0").ok).toBe(false);
    expect(params("url=https://cdn.example/a.jpg&h=-5").ok).toBe(false);
    expect(params("url=https://cdn.example/a.jpg&w=1.5").ok).toBe(false);
    expect(params("url=https://cdn.example/a.jpg&h=abc").ok).toBe(false);
  });

  it("maps wsrv inside to contain and keeps the other fit modes", () => {
    const inside = params("url=https://cdn.example/a.jpg&fit=inside");
    const cover = params("url=https://cdn.example/a.jpg&fit=COVER");
    const scaleDown = params("url=https://cdn.example/a.jpg&fit=scale-down");
    expect(inside.ok && inside.params.fit).toBe("contain");
    expect(cover.ok && cover.params.fit).toBe("cover");
    expect(scaleDown.ok && scaleDown.params.fit).toBe("scale-down");
    expect(params("url=https://cdn.example/a.jpg&fit=pad").ok).toBe(false);
  });

  it("accepts quality from 1 to 100", () => {
    const low = params("url=https://cdn.example/a.jpg&q=1");
    const high = params("url=https://cdn.example/a.jpg&q=100");
    expect(low.ok && low.params.quality).toBe(1);
    expect(high.ok && high.params.quality).toBe(100);
    expect(params("url=https://cdn.example/a.jpg&q=0").ok).toBe(false);
    expect(params("url=https://cdn.example/a.jpg&q=101").ok).toBe(false);
  });

  it("maps output names and negotiates from Accept", () => {
    const jpeg = params("url=https://cdn.example/a.jpg&output=jpg");
    const webp = params("url=https://cdn.example/a.jpg&output=WEBP");
    const avif = params("url=https://cdn.example/a.jpg", "image/avif,image/webp");
    const webpAccept = params("url=https://cdn.example/a.jpg", "image/webp");
    const fallback = params("url=https://cdn.example/a.jpg", "*/*");

    expect(jpeg.ok && jpeg.params.format).toBe("image/jpeg");
    expect(webp.ok && webp.params.format).toBe("image/webp");
    expect(avif.ok && avif.params.format).toBe("image/avif");
    expect(webpAccept.ok && webpAccept.params.format).toBe("image/webp");
    expect(fallback.ok && fallback.params.format).toBe("image/jpeg");
    expect(params("url=https://cdn.example/a.jpg&output=gif").ok).toBe(false);
  });
});

describe("blocked hosts", () => {
  it("blocks loopback, private, link-local, and metadata addresses", () => {
    const blocked = [
      "localhost",
      "app.localhost",
      "printer.local",
      "metadata.google.internal",
      "127.0.0.1",
      "127.1",
      "10.1.2.3",
      "10.1",
      "0.0.0.0",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.20",
      "169.254.169.254",
      "100.64.0.1",
      "255.255.255.255",
      "2130706433",
      "0x7f000001",
      "0177.0.0.1",
      "::1",
      "[::1]",
      "::",
      "fc00::1",
      "fd12:3456::1",
      "fe80::1",
      "::ffff:127.0.0.1",
      "::ffff:10.0.0.1",
      "internal",
    ];
    for (const host of blocked) {
      expect(isBlockedHost(host), host).toBe(true);
    }
  });

  it("allows public addresses", () => {
    const allowed = [
      "example.com",
      "cdn.example.com.",
      "8.8.8.8",
      "1.1.1.1",
      "172.15.0.1",
      "172.32.0.1",
      "11.0.0.1",
      "2606:4700:4700::1111",
      "::ffff:8.8.8.8",
    ];
    for (const host of allowed) {
      expect(isBlockedHost(host), host).toBe(false);
    }
  });

  it("enforces https, the allow list, and the service host", () => {
    expect(checkSourceUrl("http://example.com/a.jpg", "", "img-cdn.example")).toMatchObject({
      ok: false,
      status: 400,
    });
    expect(checkSourceUrl("https://user:pw@example.com/a.jpg", "", "img-cdn.example")).toMatchObject({
      ok: false,
      status: 400,
    });
    expect(checkSourceUrl("https://127.0.0.1/a.jpg", "", "img-cdn.example")).toMatchObject({
      ok: false,
      status: 403,
    });
    expect(checkSourceUrl("https://img-cdn.example/a.jpg", "", "img-cdn.example")).toMatchObject({
      ok: false,
      status: 400,
    });
    expect(checkSourceUrl("https://images.example/a.jpg", "cdn.example", "img-cdn.example").ok).toBe(false);

    const allowed = checkSourceUrl(
      "https://CDN.example/a.jpg",
      "cdn.example, images.example",
      "img-cdn.example",
    );
    expect(allowed.ok).toBe(true);

    const open = checkSourceUrl("https://cdn.example/a.jpg", "", "img-cdn.example");
    expect(open.ok).toBe(true);
  });

  it("allows every public host when ALLOWED_HOSTS is empty", () => {
    expect(isHostAllowed("Example.com", "")).toBe(true);
    expect(isHostAllowed("cdn.example", "example.com, cdn.example")).toBe(true);
    expect(isHostAllowed("images.example", "example.com")).toBe(false);
  });
});
