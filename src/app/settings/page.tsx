import { SettingsPanel } from "@/features/settings/components/SettingsPanel";
import { getSettings } from "@/features/settings/server/repository";
import { aiPublicConfiguration } from "@/features/ai/server/configuration";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ from?: string | string[] }> }) {
  const [settings, params] = await Promise.all([getSettings(), searchParams]);
  const returnTo = params.from === "agent" ? "/agent" : params.from === "tasks" ? "/?resume=1" : "/";
  return <SettingsPanel initial={settings} ai={aiPublicConfiguration()} returnTo={returnTo} />;
}
