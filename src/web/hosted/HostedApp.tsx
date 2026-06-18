import { HostedRepositoryEntry } from "../components/HostedRepositoryEntry.js";
import { ExplorerApp } from "../ExplorerApp.js";
import { useGraphStore } from "../state/graphStore.js";

export function HostedApp() {
  const graph = useGraphStore((state) => state.graph);
  return graph === undefined ? <HostedRepositoryEntry /> : <ExplorerApp />;
}
