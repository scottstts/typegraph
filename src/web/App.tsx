import { useEffect } from "react";
import { ExplorerApp } from "./ExplorerApp.js";
import { useGraphStore } from "./state/graphStore.js";

export function App() {
  const loadGraph = useGraphStore((state) => state.loadGraph);

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

  return <ExplorerApp />;
}
