import { NextResponse } from "next/server";
import { settingsPatchSchema } from "@/features/settings/schema";
import { getSettings, updateSettings } from "@/features/settings/server/repository";

export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json({ settings: await getSettings() }); }
export async function PATCH(request: Request) {
  const parsed = settingsPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_settings" }, { status: 400 });
  return NextResponse.json({ settings: await updateSettings(parsed.data) });
}
