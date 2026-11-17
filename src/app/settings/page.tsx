import { SettingsPanel } from "@/features/settings/components/SettingsPanel";
import { getSettings } from "@/features/settings/server/repository";
import { aiPublicConfiguration } from "@/features/ai/server/configuration";

export const dynamic = "force-dynamic";
export default async function SettingsPage() {
  return <SettingsPanel initial={await getSettings()} ai={aiPublicConfiguration()} />;
}
