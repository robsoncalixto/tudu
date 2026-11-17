import { describe, expect, it } from "vitest";
import { checkMcpAccess } from "./access";

const token = "tudu-unit-token-not-a-production-secret";
const request = (headers: Record<string, string> = {}, url = "http://localhost:3000/api/mcp") => new Request(url, {
  method: "POST", headers: { host: new URL(url).host, authorization: `Bearer ${token}`, ...headers },
});
describe("local MCP access", () => {
  it("stays disabled until a sufficiently long local token is configured", () => {
    expect(checkMcpAccess(request(), "")?.status).toBe(503);
    expect(checkMcpAccess(request(), "short")?.status).toBe(503);
    expect(checkMcpAccess(request(), "contains spaces but is sufficiently long")?.status).toBe(503);
  });
  it("authenticates each request and does not accept a token in the URL", () => {
    expect(checkMcpAccess(request(), token)).toBeUndefined();
    expect(checkMcpAccess(request({ authorization: `bearer ${token}` }), token)).toBeUndefined();
    expect(checkMcpAccess(request({ authorization: "Bearer wrong" }), token)?.status).toBe(401);
    expect(checkMcpAccess(request({ authorization: "" }, `http://localhost:3000/api/mcp?token=${token}`), token)?.status).toBe(401);
  });
  it("rejects untrusted hosts and origins, including null and non-loopback origins", () => {
    expect(checkMcpAccess(request({ host: "evil.example" }), token)?.status).toBe(403);
    for (const origin of ["https://evil.example", "null", "http://192.168.68.55:3000"]) {
      expect(checkMcpAccess(request({ origin }), token)?.status).toBe(403);
    }
    expect(checkMcpAccess(request({ origin: "http://localhost:3000" }), token)).toBeUndefined();
    expect(checkMcpAccess(request({}, "http://127.0.0.1:3000/api/mcp"), token)).toBeUndefined();
    expect(checkMcpAccess(request({}, "http://[::1]:3000/api/mcp"), token)).toBeUndefined();
  });
});
