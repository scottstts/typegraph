import { type CSSProperties, type PointerEvent, useEffect, useState } from "react";
import { GraphCanvas } from "./components/GraphCanvas.js";
import { Inspector } from "./components/Inspector.js";
import { SearchPanel } from "./components/SearchPanel.js";
import { useGraphStore } from "./state/graphStore.js";

const MIN_LEFT_PANEL_WIDTH = 260;
const MAX_LEFT_PANEL_WIDTH = 520;
const MIN_RIGHT_PANEL_WIDTH = 320;
const MAX_RIGHT_PANEL_WIDTH = 600;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function App() {
  const loadGraph = useGraphStore((state) => state.loadGraph);
  const [leftPanelWidth, setLeftPanelWidth] = useState(320);
  const [rightPanelWidth, setRightPanelWidth] = useState(390);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);

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

  function beginPanelResize(
    panel: "left" | "right",
    event: PointerEvent<HTMLDivElement>
  ): void {
    const startX = event.clientX;
    const startWidth = panel === "left" ? leftPanelWidth : rightPanelWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    function handlePointerMove(moveEvent: globalThis.PointerEvent): void {
      const delta = moveEvent.clientX - startX;
      if (panel === "left") {
        setLeftPanelWidth(
          clamp(startWidth + delta, MIN_LEFT_PANEL_WIDTH, MAX_LEFT_PANEL_WIDTH)
        );
      } else {
        setRightPanelWidth(
          clamp(startWidth - delta, MIN_RIGHT_PANEL_WIDTH, MAX_RIGHT_PANEL_WIDTH)
        );
      }
    }

    function handlePointerUp(): void {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
  }

  const shellStyle = {
    "--left-panel-width": `${leftPanelCollapsed ? 0 : leftPanelWidth}px`,
    "--right-panel-width": `${rightPanelCollapsed ? 0 : rightPanelWidth}px`,
    "--left-resizer-width": leftPanelCollapsed ? "0px" : "8px",
    "--right-resizer-width": rightPanelCollapsed ? "0px" : "8px"
  } as CSSProperties;

  return (
    <div
      className={[
        "app-shell",
        leftPanelCollapsed ? "left-panel-collapsed" : "",
        rightPanelCollapsed ? "right-panel-collapsed" : ""
      ]
        .filter(Boolean)
        .join(" ")}
      style={shellStyle}
    >
      {leftPanelCollapsed ? (
        <div className="panel collapsed-panel" aria-hidden="true" />
      ) : (
        <SearchPanel />
      )}
      {leftPanelCollapsed ? (
        <div className="panel-resizer collapsed" aria-hidden="true" />
      ) : (
        <div
          className="panel-resizer"
          role="separator"
          aria-label="Resize search panel"
          aria-orientation="vertical"
          onPointerDown={(event) => beginPanelResize("left", event)}
        />
      )}
      <GraphCanvas
        leftPanelCollapsed={leftPanelCollapsed}
        rightPanelCollapsed={rightPanelCollapsed}
        onToggleLeftPanel={() => setLeftPanelCollapsed((collapsed) => !collapsed)}
        onToggleRightPanel={() => setRightPanelCollapsed((collapsed) => !collapsed)}
      />
      {rightPanelCollapsed ? (
        <div className="panel-resizer collapsed" aria-hidden="true" />
      ) : (
        <div
          className="panel-resizer"
          role="separator"
          aria-label="Resize inspector panel"
          aria-orientation="vertical"
          onPointerDown={(event) => beginPanelResize("right", event)}
        />
      )}
      {rightPanelCollapsed ? (
        <div className="panel collapsed-panel" aria-hidden="true" />
      ) : (
        <Inspector />
      )}
    </div>
  );
}
