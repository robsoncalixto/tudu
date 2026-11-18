import { afterEach, expect, it, vi } from "vitest";
import { checkMcpAccess } from "./access";
import { mcpCorsResponse, mcpPreflightResponse } from "./cors";

const server = "http://tudu.example:8085";
const client = "https://client.example";
const token = "test-only-token-for-the-cors-unit-tests";
afterEach(() => vi.unstubAllEnvs());

function request(origin: string, method = "OPTIONS") {
  return new Request(server + "/api/mcp", { method, headers: { Host: "tudu.example:8085", Origin: origin } });
}

it("lets an explicitly configured browser preflight without credentials before an authenticated request", () => {
  vi.stubEnv("TUDU_MCP_ALLOWED_ORIGINS", [server, client].join(","));
  const preflight = request(client);
  expect(checkMcpAccess(preflight, token)).toBeUndefined();
  const response = mcpCorsResponse(preflight, mcpPreflightResponse());
  expect(response.status).toBe(204);
  expect(response.headers.get("Access-Control-Allow-Origin")).toBe(client);
  expect(response.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
  expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  const post = request(client, "POST");
  const failure = mcpCorsResponse(post, checkMcpAccess(post, token)!);
  expect(failure.status).toBe(401);
  expect(failure.headers.get("Access-Control-Allow-Origin")).toBe(client);
});

it("limits preflight to enabled servers and grants no cross-origin access to unlisted callers", () => {
  vi.stubEnv("TUDU_MCP_ALLOWED_ORIGINS", server);
  const denied = request(client);
  const response = mcpCorsResponse(denied, checkMcpAccess(denied, token)!);
  expect(response.status).toBe(403);
  expect(response.headers.has("Access-Control-Allow-Origin")).toBe(false);
  expect(checkMcpAccess(request(server), "")?.status).toBe(503);
});
