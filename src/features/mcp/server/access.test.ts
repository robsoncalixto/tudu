import { describe, expect, it } from "vitest";
import { checkMcpAccess, isConfiguredMcpOrigin } from "./access";

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
  it("allows configured authorities and browser origins while requiring a bearer token", () => {
    const lan = "http://192.168.68.55:3000";
    const origins = ` ${lan}, https://tudu.example `;
    const url = `${lan}/api/mcp`;
    expect(checkMcpAccess(request({}, url), token, origins)).toBeUndefined();
    expect(checkMcpAccess(request({ origin: lan }, url), token, origins)).toBeUndefined();
    expect(checkMcpAccess(request({ host: "tudu.example:443", origin: "https://tudu.example" }), token, origins)).toBeUndefined();
    expect(checkMcpAccess(request({ authorization: "" }, url), token, origins)?.status).toBe(401);
    expect(checkMcpAccess(request({}, url), "", origins)?.status).toBe(503);
    expect(checkMcpAccess(request(), token, origins)).toBeUndefined();
  });
  it("recognizes only explicitly configured browser origins", () => {
    const origins = "https://TUDU.EXAMPLE:443/, http://[fd00::1]:3000";
    expect(isConfiguredMcpOrigin("https://tudu.example", origins)).toBe(true);
    expect(isConfiguredMcpOrigin("http://[fd00::1]:3000", origins)).toBe(true);
    expect(isConfiguredMcpOrigin("http://localhost", origins)).toBe(false);
    expect(isConfiguredMcpOrigin("https://tudu.example:3000", origins)).toBe(false);
  });
  it("checks the Host and Origin independently, including non-default ports and the origin scheme", () => {
    const lan = "http://tudu.lan:3000";
    const url = `${lan}/api/mcp`;
    for (const host of ["tudu.lan", "tudu.lan:3001", "sub.tudu.lan:3000"]) {
      expect(checkMcpAccess(request({ host, origin: lan }, url), token, lan)?.status).toBe(403);
    }
    for (const origin of ["http://tudu.lan", "https://tudu.lan:3000", "http://sub.tudu.lan:3000", "null"]) {
      expect(checkMcpAccess(request({ origin }, url), token, lan)?.status).toBe(403);
    }
  });
  it("ignores malformed allowlist entries without granting access to their host", () => {
    const invalid = ["*", "http://*.lan:3000", "tudu.lan:3000", "ftp://tudu.lan:3000",
      "http://me@tudu.lan:3000", "http://tudu.lan:3000/path", "http://tudu.lan:3000?query", "http://tudu.lan:3000#fragment"];
    const origins = [...invalid, "http://other.lan:3000"].join(",");
    expect(checkMcpAccess(request({}, "http://other.lan:3000/api/mcp"), token, origins)).toBeUndefined();
    expect(checkMcpAccess(request({}, "http://tudu.lan:3000/api/mcp"), token, origins)?.status).toBe(403);
    expect(checkMcpAccess(request({ origin: "http://tudu.lan:3000" }), token, origins)?.status).toBe(403);
  });
});
