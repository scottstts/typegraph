import { useEffect } from "react";
import { GraphCanvas } from "./components/GraphCanvas.js";
import { Inspector } from "./components/Inspector.js";
import { SearchPanel } from "./components/SearchPanel.js";
import { useGraphStore } from "./state/graphStore.js";

export function App() {
  const loadGraph = useGraphStore((state) => state.loadGraph);
  const loading = useGraphStore((state) => state.loading);
  const error = useGraphStore((state) => state.error);
  const graph = useGraphStore((state) => state.graph);
  const updatedAt = useGraphStore((state) => state.updatedAt);

  useEffect(() => {
    void loadGraph();
  }, [loadGraph]);

  useEffect(() => {
    const events = new EventSource("/api/events");
    events.addEventListener("graph-update", () => {
      void loadGraph();
    });

    return () => events.close();
  }, [loadGraph]);

  return (
    <div className="app-shell">
      <SearchPanel />
      <GraphCanvas />
      <Inspector />

      <div className="status-strip">
        <span>{loading ? "Indexing..." : "Ready"}</span>
        {graph !== undefined && (
          <span>
            {graph.nodes.length} nodes · {graph.edges.length} edges
          </span>
        )}
        {updatedAt !== undefined && <span>Updated {new Date(updatedAt).toLocaleTimeString()}</span>}
        {error !== undefined && <strong>{error}</strong>}
      </div>
    </div>
  );
}
