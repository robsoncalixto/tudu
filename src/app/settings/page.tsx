import { SettingsPanel } from "@/features/settings/components/SettingsPanel";
import { getSettings } from "@/features/settings/server/repository";
import { aiEnabled } from "@/features/capture/server/capture";

export const dynamic = "force-dynamic";
export default async function SettingsPage() {
  return <SettingsPanel initial={await getSettings()} aiEnabled={aiEnabled()} />;
}
