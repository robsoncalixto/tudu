import { readFile } from "node:fs/promises";
import path from "node:path";
import { workerSource } from "@/features/pwa/server/worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const id = await readFile(path.join(process.cwd(), ".next/BUILD_ID"), "utf8").catch(() => "development");
  return new Response(`const CACHE = ${JSON.stringify(`tudu-shell-${id.trim()}`)};\n${workerSource}`, {
    headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
