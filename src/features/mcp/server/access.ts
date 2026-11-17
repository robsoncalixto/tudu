import { timingSafeEqual } from "node:crypto";
import { hostHeaderValidationResponse, localhostAllowedHostnames, localhostAllowedOrigins, originValidationResponse } from "@modelcontextprotocol/server";

export function checkMcpAccess(request: Request, token = process.env.TUDU_MCP_TOKEN): Response | undefined {
  if (!token || !/^[A-Za-z0-9_-]{32,256}$/.test(token)) {
    return Response.json({ error: "mcp_disabled" }, { status: 503 });
  }
  const rejected = hostHeaderValidationResponse(request, localhostAllowedHostnames())
    ?? originValidationResponse(request, localhostAllowedOrigins());
  if (rejected) return rejected;
  const supplied = /^Bearer (\S+)$/i.exec(request.headers.get("authorization") ?? "")?.[1] ?? "";
  const actual = Buffer.from(supplied);
  const expected = Buffer.from(token);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return Response.json({ error: "mcp_unauthorized" }, { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="TUDU MCP"' } });
  }
}
