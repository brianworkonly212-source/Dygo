import { HanoiExplorerApp } from "@/components/hanoi-explorer-app";
import { getExplorerData } from "@/lib/data/repository-server";

export default async function Home() {
  const data = await getExplorerData();

  return <HanoiExplorerApp initialData={data} />;
}
