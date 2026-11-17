import { WorkLogPanel } from "@/features/work-log/components/WorkLogPanel";
import { getSettings } from "@/features/settings/server/repository";

export const dynamic = "force-dynamic";
export default async function WorkLogPage() {
  return <WorkLogPanel settings={await getSettings()} />;
}
