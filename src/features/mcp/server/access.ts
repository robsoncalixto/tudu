import { timingSafeEqual } from "node:crypto";
import { hostHeaderValidationResponse, localhostAllowedHostnames, localhostAllowedOrigins, originValidationResponse } from "@modelcontextprotocol/server";

function parseConfiguredOrigins(configured: string | undefined): URL[] {
  const origins: URL[] = [];
  for (const entry of (configured ?? "").split(",")) {
    const value = entry.trim();
    // URL parsing alone would silently discard paths, credentials and other non-origin input.
    if (!/^https?:\/\/(?:[a-z\d._-]+|\[[a-f\d:.]+\])(?::\d+)?\/?$/i.test(value)) continue;
    const origin = URL.parse(value);
    if (origin) origins.push(origin);
  }
  return origins;
}

export function isConfiguredMcpOrigin(origin: string, configured = process.env.TUDU_MCP_ALLOWED_ORIGINS): boolean {
  return parseConfiguredOrigins(configured).some((allowed) => allowed.origin === origin);
}

export function checkMcpOriginAccess(request: Request, configured = process.env.TUDU_MCP_ALLOWED_ORIGINS): Response | undefined {
  const origins = parseConfiguredOrigins(configured);
  const host = request.headers.get("host")?.toLowerCase();
  const origin = request.headers.get("origin");
  // The SDK's loopback checks allow any port. Additional hosts must match the configured port.
  const matchesHost = origins.some((allowed) => host === allowed.host ||
    (!allowed.port && host === `${allowed.hostname}:${allowed.protocol === "https:" ? "443" : "80"}`));
  if (!matchesHost) {
    const rejected = hostHeaderValidationResponse(request, localhostAllowedHostnames());
    if (rejected) return rejected;
  }
  if (!origins.some((allowed) => allowed.origin === origin)) {
    return originValidationResponse(request, localhostAllowedOrigins());
  }
}

export function checkMcpAccess(request: Request, token = process.env.TUDU_MCP_TOKEN, configured = process.env.TUDU_MCP_ALLOWED_ORIGINS): Response | undefined {
  if (!token || !/^[A-Za-z0-9_-]{32,256}$/.test(token)) {
    return Response.json({ error: "mcp_disabled" }, { status: 503 });
  }
  const rejected = checkMcpOriginAccess(request, configured);
  if (rejected) return rejected;
  // Browser preflights carry no bearer token and never dispatch an MCP operation.
  if (request.method === "OPTIONS") return;
  const supplied = /^Bearer (\S+)$/i.exec(request.headers.get("authorization") ?? "")?.[1] ?? "";
  const actual = Buffer.from(supplied);
  const expected = Buffer.from(token);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return Response.json({ error: "mcp_unauthorized" }, { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="TUDU MCP"' } });
  }
}
