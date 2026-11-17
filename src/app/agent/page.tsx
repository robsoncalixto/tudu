import { AgentPanel } from "@/features/agent/components/AgentPanel";
import { getSettings } from "@/features/settings/server/repository";

export const dynamic = "force-dynamic";
export default async function AgentPage() {
  return <AgentPanel settings={await getSettings()} />;
}
