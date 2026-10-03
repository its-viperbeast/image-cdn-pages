const BLOCKED_HOST_NAMES = new Set(["metadata.google.internal", "metadata.goog"]);

type RequestFailure = { ok: false; status: number; message: string };

function normalizeHost(hostname: string): string {
  let host = hostname.trim().toLowerCase();
  if (host.startsWith("[") && host.endsWith("]")) {
    host = host.slice(1, -1);
  }
  while (host.endsWith(".")) {
    host = host.slice(0, -1);
  }
  const zone = host.indexOf("%");
  if (zone !== -1) {
    host = host.slice(0, zone);
  }
  return host;
}

export function isHostAllowed(hostname: string, allowedHosts: string): boolean {
  return isNormalizedHostAllowed(normalizeHost(hostname), allowedHosts);
}

function isNormalizedHostAllowed(hostname: string, allowedHosts: string): boolean {
  const trimmed = allowedHosts.trim();
  if (!trimmed) return true;
  for (const entry of trimmed.split(",")) {
    const allowedHost = normalizeHost(entry);
    if (!allowedHost) continue;
    if (allowedHost === hostname) return true;
  }
  return false;
}

export function isBlockedHost(hostname: string): boolean {
  const host = normalizeHost(hostname);
  return isNormalizedHostBlocked(host);
}

function isNormalizedHostBlocked(host: string): boolean {
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (BLOCKED_HOST_NAMES.has(host)) return true;

  const ipv4 = parseIpv4Host(host);
  if (ipv4 === "invalid") return true;
  if (ipv4) return isPrivateIpv4(ipv4);

  const ipv6 = parseIpv6Host(host);
  if (ipv6 === "invalid") return true;
  if (typeof ipv6 === "bigint") return isPrivateIpv6(ipv6);

  return !host.includes(".");
}

export function checkSourceUrl(
  raw: string,
  allowedHosts: string,
  serviceHost: string,
): { ok: true } | RequestFailure {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, status: 400, message: "Invalid url" };
  }

  if (url.protocol !== "https:") {
    return { ok: false, status: 400, message: "Only https URLs are allowed" };
  }
  if (url.username || url.password) {
    return { ok: false, status: 400, message: "URL credentials are not allowed" };
  }
  const hostname = normalizeHost(url.hostname);
  if (!isNormalizedHostAllowed(hostname, allowedHosts) || isNormalizedHostBlocked(hostname)) {
    return { ok: false, status: 403, message: "Host is not allowed" };
  }
  if (hostname === normalizeHost(serviceHost)) {
    return { ok: false, status: 400, message: "Source URL must not point at this service" };
  }

  return { ok: true };
}

type Ipv4 = readonly [number, number, number, number];

function parseIpv4Host(host: string): Ipv4 | "invalid" | null {
  const labels = host.split(".");
  const numeric = labels.every((label) => /^(0x[0-9a-f]+|\d+)$/i.test(label));
  if (!numeric) return null;
  if (labels.length > 4) return "invalid";

  const parts: number[] = [];
  for (const label of labels) {
    const value = parseNumericLabel(label);
    if (value === null) return "invalid";
    parts.push(value);
  }

  const ipv4 = ipv4FromParts(parts);
  return ipv4 ?? "invalid";
}

function parseNumericLabel(label: string): number | null {
  if (/^0x[0-9a-f]+$/i.test(label)) {
    const value = Number.parseInt(label, 16);
    return Number.isSafeInteger(value) ? value : null;
  }
  if (!/^\d+$/.test(label)) return null;
  if (label.length > 1 && label.startsWith("0")) {
    if (!/^[0-7]+$/.test(label)) return null;
    return Number.parseInt(label, 8);
  }
  const value = Number(label);
  return Number.isSafeInteger(value) ? value : null;
}

function ipv4FromParts(parts: number[]): Ipv4 | null {
  if (parts.length === 0 || parts.length > 4) return null;
  if (parts.some((part) => part < 0)) return null;

  let value = 0n;
  if (parts.length === 1) {
    value = BigInt(parts[0]);
  } else if (parts.length === 2) {
    if (parts[0] > 0xff || parts[1] > 0xffffff) return null;
    value = BigInt(parts[0]) * 0x1000000n + BigInt(parts[1]);
  } else if (parts.length === 3) {
    if (parts[0] > 0xff || parts[1] > 0xff || parts[2] > 0xffff) return null;
    value = BigInt(parts[0]) * 0x1000000n + BigInt(parts[1]) * 0x10000n + BigInt(parts[2]);
  } else if (parts[0] > 0xff || parts[1] > 0xff || parts[2] > 0xff || parts[3] > 0xff) {
    return null;
  } else {
    value =
      BigInt(parts[0]) * 0x1000000n +
      BigInt(parts[1]) * 0x10000n +
      BigInt(parts[2]) * 0x100n +
      BigInt(parts[3]);
  }

  if (value > 0xffffffffn) return null;
  const packed = Number(value);
  return [(packed >>> 24) & 0xff, (packed >>> 16) & 0xff, (packed >>> 8) & 0xff, packed & 0xff];
}

function isPrivateIpv4(octets: Ipv4): boolean {
  const [a, b] = octets;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 255) return true;
  return false;
}

function parseIpv6Host(host: string): bigint | "invalid" | null {
  if (!host.includes(":")) return null;
  const address = host.toLowerCase();
  if (address.includes(":::")) return "invalid";

  const halves = address.split("::");
  if (halves.length > 2) return "invalid";

  const left = parseIpv6Side(halves[0] ?? "");
  if (left === null) return "invalid";
  const right = halves.length === 2 ? parseIpv6Side(halves[1] ?? "") : [];
  if (right === null) return "invalid";

  if (halves.length === 1) {
    if (left.length !== 8) return "invalid";
    return groupsToBigInt(left);
  }

  const missing = 8 - left.length - right.length;
  if (missing < 1) return "invalid";
  return groupsToBigInt([...left, ...new Array<number>(missing).fill(0), ...right]);
}

function parseIpv6Side(side: string): number[] | null {
  if (side === "") return [];
  const labels = side.split(":");
  const groups: number[] = [];
  for (let index = 0; index < labels.length; index++) {
    const label = labels[index] ?? "";
    if (label.includes(".")) {
      if (index !== labels.length - 1) return null;
      const ipv4 = parseIpv4Host(label);
      if (!ipv4 || ipv4 === "invalid") return null;
      groups.push((ipv4[0] << 8) | ipv4[1], (ipv4[2] << 8) | ipv4[3]);
      continue;
    }
    if (!/^[0-9a-f]{1,4}$/.test(label)) return null;
    groups.push(Number.parseInt(label, 16));
  }
  return groups;
}

function groupsToBigInt(groups: number[]): bigint {
  let value = 0n;
  for (const group of groups) {
    value = (value << 16n) + BigInt(group);
  }
  return value;
}

function isPrivateIpv6(value: bigint): boolean {
  if (value === 0n || value === 1n) return true;

  const first = Number((value >> 112n) & 0xffffn);
  if (first >= 0xfe80 && first <= 0xfebf) return true;
  if (first >= 0xfc00 && first <= 0xfdff) return true;

  const top96 = value >> 32n;
  if (top96 === 0xffffn || top96 === 0n) {
    const packed = Number(value & 0xffffffffn);
    if (packed === 0) return true;
    return isPrivateIpv4([
      (packed >>> 24) & 0xff,
      (packed >>> 16) & 0xff,
      (packed >>> 8) & 0xff,
      packed & 0xff,
    ]);
  }

  return false;
}
