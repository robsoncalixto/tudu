import { isConfiguredMcpOrigin } from "./access";

const methods = "GET, POST, DELETE, OPTIONS";

export function mcpPreflightResponse(): Response {
  return new Response(null, { status: 204, headers: { Allow: methods } });
}

export function mcpCorsResponse(request: Request, response: Response): Response {
  response.headers.append("Vary", "Origin");
  const origin = request.headers.get("Origin");
  if (!origin || !isConfiguredMcpOrigin(origin)) return response;
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Expose-Headers", "Mcp-Session-Id, MCP-Protocol-Version, WWW-Authenticate");
  if (request.method === "OPTIONS" && response.ok) {
    response.headers.set("Access-Control-Allow-Methods", methods);
    response.headers.set("Access-Control-Allow-Headers",
      "Accept, Authorization, Content-Type, Last-Event-ID, Mcp-Method, Mcp-Name, MCP-Protocol-Version, Mcp-Session-Id");
  }
  return response;
}
