import { createServer } from "node:http";

let fixture = { plan: { proposals: [] }, status: 200 };
let requests = [];
const server = createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString();
  response.setHeader("Content-Type", "application/json");
  if (request.url === "/health") { response.end('{}'); return; }
  if (request.url === "/fixture") {
    if (request.method === "PUT") { fixture = JSON.parse(raw); requests = []; }
    response.end(JSON.stringify({ fixture, requests })); return;
  }
  if (request.url !== "/v1/responses" || request.method !== "POST") { response.writeHead(404).end('{}'); return; }
  const body = JSON.parse(raw); requests.push(body);
  response.statusCode = fixture.status ?? 200;
  if (response.statusCode !== 200) { response.end(JSON.stringify({ error: { message: "Synthetic provider error", type: "api_error" } })); return; }
  response.end(JSON.stringify({
    id: "resp-test", object: "response", created_at: 1, model: body.model, status: "completed",
    output: [{ type: "message", id: "msg-test", role: "assistant", status: "completed", content: [
      { type: "output_text", text: JSON.stringify(fixture.plan), annotations: [] },
    ] }],
  }));
});
server.listen(Number(process.env.TUDU_AI_TEST_PORT ?? 3120), "127.0.0.1");
process.on("SIGTERM", () => server.close());
