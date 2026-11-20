import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [id, script] = await Promise.all([
    readFile(path.join(process.cwd(), ".next/BUILD_ID"), "utf8").catch(() => "development"),
    readFile(path.join(process.cwd(), "public/tudu-service-worker.js"), "utf8"),
  ]);
  return new Response(`const CACHE = ${JSON.stringify(`tudu-shell-${id.trim()}`)};\n${script}`, {
    headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
