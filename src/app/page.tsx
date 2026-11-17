import { Board } from "@/features/tasks/components/Board";
import { getSettings } from "@/features/settings/server/repository";

export const dynamic = "force-dynamic";
export default async function Home() {
  return <Board settings={await getSettings()} />;
}
