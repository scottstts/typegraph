import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type { CSSProperties } from "react";
import {
  Controls,
  ReactFlow,
  ViewportPortal,
  type CoordinateExtent,
  type EdgeTypes,
  type NodeTypes,
  type ReactFlowInstance,
  type Viewport
} from "@xyflow/react";
import { nodeMatchesFilters } from "../graphUi.js";
import {
  buildCanvasLayout,
  decorateCanvasLayout,
  emptyCanvasLayout,
  type CanvasLayout,
  type SourceLane
} from "../graphLayout.js";
import { useGraphStore } from "../state/graphStore.js";
import { CanvasEdge, type TypeGraphFlowEdge } from "./CanvasEdge.js";
import { NodeCard, type TypeGraphFlowNode } from "./NodeCard.js";

const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 0.72 };
const ABSOLUTE_MIN_ZOOM = 0.035;
const MAX_ZOOM = 1.65;
const SELECTED_NODE_ZOOM = 1;
const HOVER_CARD_SCREEN_GAP = 14;
const VIEWPORT_POSITION_EPSILON = 0.5;
const VIEWPORT_ZOOM_EPSILON = 0.0001;

const nodeTypes: NodeTypes = {
  typeGraphNode: NodeCard
};

const edgeTypes: EdgeTypes = {
  canvasEdge: CanvasEdge
};

function SourceLaneLayer({
  lanes,
  width,
  height
}: {
  lanes: SourceLane[];
  width: number;
  height: number;
}) {
  return (
    <ViewportPortal>
      <div
        className="source-lane-layer"
        style={
          {
            "--lane-layer-width": `${width}px`,
            "--lane-layer-height": `${height}px`
          } as CSSProperties
        }
      >
        {lanes.map((lane) => (
          <div
            key={lane.id}
            className="source-lane"
            style={
              {
                "--lane-y": `${lane.y}px`,
                "--lane-height": `${lane.height}px`,
                "--lane-width": `${lane.width}px`,
                "--lane-color": lane.color,
                "--lane-fill": lane.fill
              } as CSSProperties
            }
          />
        ))}
      </div>
    </ViewportPortal>
  );
}

function FixedSourceRail({
  lanes,
  width,
  viewport
}: {
  lanes: SourceLane[];
  width: number;
  viewport: Viewport;
}) {
  return (
    <div
      className="source-rail-overlay"
      style={
        {
          "--source-rail-width": `${width}px`
        } as CSSProperties
      }
    >
      {lanes.map((lane) => (
        <div
          key={lane.id}
          className="source-rail-entry"
          style={
            {
              "--lane-screen-y": `${viewport.y + lane.y * viewport.zoom}px`,
              "--lane-screen-height": `${lane.height * viewport.zoom}px`,
              "--lane-color": lane.color,
              "--lane-fill": lane.fill
            } as CSSProperties
          }
        >
          <span>{lane.directory}</span>
          <strong>{lane.fileName}</strong>
          <small>{lane.nodeCount} nodes</small>
        </div>
      ))}
    </div>
  );
}

function NodeHoverCardOverlay({
  node,
  viewport
}: {
  node: TypeGraphFlowNode;
  viewport: Viewport;
}) {
  const graphNode = node.data.graphNode;
  const left = viewport.x + (node.position.x + node.data.width) * viewport.zoom + HOVER_CARD_SCREEN_GAP;
  const top = viewport.y + (node.position.y + node.data.height / 2) * viewport.zoom;

  return (
    <div
      className="node-hover-card"
      role="tooltip"
      style={
        {
          "--node-color": node.data.sourceColor,
          "--node-hover-card-left": `${left}px`,
          "--node-hover-card-top": `${top}px`
        } as CSSProperties
      }
    >
      <strong>{graphNode.name}</strong>
      <span>from {graphNode.relativeFilePath ?? "generated graph"}</span>
      <span>
        depends on <b>{graphNode.dependsOn.length}</b>
      </span>
      {graphNode.dependedOnBy.length === 0 ? (
        <span>
          <b>Root Node</b>
        </span>
      ) : (
        <span>
          used by <b>{graphNode.dependedOnBy.length}</b>
        </span>
      )}
    </div>
  );
}

type GraphCanvasProps = {
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;
  onToggleLeftPanel: () => void;
  onToggleRightPanel: () => void;
};

type FlowInstance = ReactFlowInstance<TypeGraphFlowNode, TypeGraphFlowEdge>;

type CanvasSize = {
  width: number;
  height: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function clampViewportToLaneSurface(
  viewport: Viewport,
  canvasSize: CanvasSize,
  layout: CanvasLayout,
  minZoom: number
): Viewport {
  const zoom = Math.min(MAX_ZOOM, Math.max(viewport.zoom, minZoom));
  const scaledWidth = layout.width * zoom;
  const scaledHeight = layout.height * zoom;
  const minX = Math.min(layout.sourceRailWidth, canvasSize.width - scaledWidth);
  const maxX = layout.sourceRailWidth;
  const minY = Math.min(0, canvasSize.height - scaledHeight);

  return {
    x: clamp(viewport.x, minX, maxX),
    y: clamp(viewport.y, minY, 0),
    zoom
  };
}

function viewportNeedsUpdate(current: Viewport, next: Viewport): boolean {
  return (
    Math.abs(current.x - next.x) > VIEWPORT_POSITION_EPSILON ||
    Math.abs(current.y - next.y) > VIEWPORT_POSITION_EPSILON ||
    Math.abs(current.zoom - next.zoom) > VIEWPORT_ZOOM_EPSILON
  );
}

export function GraphCanvas({
  leftPanelCollapsed,
  rightPanelCollapsed,
  onToggleLeftPanel,
  onToggleRightPanel
}: GraphCanvasProps) {
  const graph = useGraphStore((state) => state.graph);
  const selectedNodeId = useGraphStore((state) => state.selectedNodeId);
  const searchQuery = useGraphStore((state) => state.searchQuery);
  const showPrimitives = useGraphStore((state) => state.showPrimitives);
  const showExternal = useGraphStore((state) => state.showExternal);
  const exportedOnly = useGraphStore((state) => state.exportedOnly);
  const excludeTests = useGraphStore((state) => state.excludeTests);
  const excludeOrphans = useGraphStore((state) => state.excludeOrphans);
  const kindFilters = useGraphStore((state) => state.kindFilters);
  const loading = useGraphStore((state) => state.loading);
  const error = useGraphStore((state) => state.error);
  const updatedAt = useGraphStore((state) => state.updatedAt);
  const selectNode = useGraphStore((state) => state.selectNode);
  const clearSelection = useGraphStore((state) => state.clearSelection);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | undefined>();
  const [baseLayout, setBaseLayout] = useState<CanvasLayout>(emptyCanvasLayout);
  const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT);
  const [flowInstance, setFlowInstance] = useState<FlowInstance | undefined>();
  const [canvasSize, setCanvasSize] = useState<CanvasSize>({ width: 0, height: 0 });
  const flowWrapRef = useRef<HTMLDivElement | null>(null);
  const hoverClearTimeout = useRef<number | undefined>(undefined);

  useEffect(() => {
    const element = flowWrapRef.current;
    if (element === null) {
      return undefined;
    }

    const observedElement = element;

    function updateCanvasSize(): void {
      setCanvasSize((currentSize) => {
        const nextSize = {
          width: observedElement.clientWidth,
          height: observedElement.clientHeight
        };

        return currentSize.width === nextSize.width &&
          currentSize.height === nextSize.height
          ? currentSize
          : nextSize;
      });
    }

    updateCanvasSize();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateCanvasSize);
      return () => window.removeEventListener("resize", updateCanvasSize);
    }

    const observer = new ResizeObserver(updateCanvasSize);
    observer.observe(observedElement);
    return () => observer.disconnect();
  }, []);

  const cancelHoverClear = useCallback(() => {
    if (hoverClearTimeout.current !== undefined) {
      window.clearTimeout(hoverClearTimeout.current);
      hoverClearTimeout.current = undefined;
    }
  }, []);

  const handleNodeHoverStart = useCallback(
    (nodeId: string) => {
      cancelHoverClear();
      setHoveredNodeId(nodeId);
    },
    [cancelHoverClear]
  );

  const handleNodeHoverEnd = useCallback(
    (nodeId: string) => {
      cancelHoverClear();
      hoverClearTimeout.current = window.setTimeout(() => {
        setHoveredNodeId((currentNodeId) =>
          currentNodeId === nodeId ? undefined : currentNodeId
        );
        hoverClearTimeout.current = undefined;
      }, 90);
    },
    [cancelHoverClear]
  );

  useEffect(() => cancelHoverClear, [cancelHoverClear]);

  const filteredGraph = useMemo(() => {
    if (graph === undefined) {
      return { nodes: [], edges: [] };
    }

    const nodes = graph.nodes
      .filter((node) =>
        nodeMatchesFilters(node, graph, {
          searchQuery,
          showPrimitives,
          showExternal,
          exportedOnly,
          excludeTests,
          excludeOrphans,
          kindFilters
        })
      )
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

    const visibleIds = new Set(nodes.map((node) => node.id));
    const edges = graph.edges.filter(
      (edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to)
    );

    return { nodes, edges };
  }, [
    excludeOrphans,
    excludeTests,
    exportedOnly,
    graph,
    kindFilters,
    searchQuery,
    showExternal,
    showPrimitives
  ]);

  const visibleGraph = useMemo(() => {
    if (
      graph === undefined ||
      selectedNodeId === undefined ||
      filteredGraph.nodes.some((node) => node.id === selectedNodeId)
    ) {
      return filteredGraph;
    }

    const selectedNode = graph.nodes.find((node) => node.id === selectedNodeId);
    if (selectedNode === undefined) {
      return filteredGraph;
    }

    const nodes = [...filteredGraph.nodes, selectedNode].sort(
      (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
    );

    const visibleIds = new Set(nodes.map((node) => node.id));
    const edges = graph.edges.filter(
      (edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to)
    );

    return { nodes, edges };
  }, [filteredGraph, graph, selectedNodeId]);

  useEffect(() => {
    let cancelled = false;

    if (graph === undefined || visibleGraph.nodes.length === 0) {
      setBaseLayout(emptyCanvasLayout);
      return () => {
        cancelled = true;
      };
    }

    void buildCanvasLayout(visibleGraph.nodes, visibleGraph.edges).then((layout) => {
      if (!cancelled) {
        setBaseLayout(layout);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [graph, visibleGraph.edges, visibleGraph.nodes]);

  const decoratedLayout = useMemo(
    () => decorateCanvasLayout(baseLayout, selectedNodeId, hoveredNodeId),
    [baseLayout, hoveredNodeId, selectedNodeId]
  );
  const nodes = useMemo<TypeGraphFlowNode[]>(
    () =>
      decoratedLayout.nodes.map((node): TypeGraphFlowNode => ({
        ...node,
        data: {
          ...node.data,
          onHoverStart: handleNodeHoverStart,
          onHoverEnd: handleNodeHoverEnd
        }
      })),
    [decoratedLayout.nodes, handleNodeHoverEnd, handleNodeHoverStart]
  );
  const { edges } = decoratedLayout;
  const minZoom = useMemo(() => {
    if (
      canvasSize.width <= 0 ||
      canvasSize.height <= 0 ||
      baseLayout.width <= 0 ||
      baseLayout.height <= 0
    ) {
      return ABSOLUTE_MIN_ZOOM;
    }

    return Math.min(
      MAX_ZOOM,
      Math.max(
        ABSOLUTE_MIN_ZOOM,
        canvasSize.width / baseLayout.width,
        canvasSize.height / baseLayout.height
      )
    );
  }, [baseLayout.height, baseLayout.width, canvasSize.height, canvasSize.width]);
  const nodeExtent = useMemo<CoordinateExtent>(
    () => [
      [0, 0],
      [Math.max(baseLayout.width, 1), Math.max(baseLayout.height, 1)]
    ],
    [baseLayout.height, baseLayout.width]
  );
  const translateExtent = useMemo<CoordinateExtent>(() => {
    const safeZoom = Math.max(viewport.zoom, minZoom);
    return [
      [-baseLayout.sourceRailWidth / safeZoom, 0],
      [Math.max(baseLayout.width, 1), Math.max(baseLayout.height, 1)]
    ];
  }, [baseLayout.height, baseLayout.sourceRailWidth, baseLayout.width, minZoom, viewport.zoom]);

  useLayoutEffect(() => {
    if (
      flowInstance === undefined ||
      canvasSize.width <= 0 ||
      canvasSize.height <= 0
    ) {
      return;
    }

    const currentViewport = flowInstance.getViewport();
    const nextViewport = clampViewportToLaneSurface(
      currentViewport,
      canvasSize,
      baseLayout,
      minZoom
    );
    if (!viewportNeedsUpdate(currentViewport, nextViewport)) {
      return;
    }

    void flowInstance.setViewport(nextViewport, { duration: 0 });
  }, [baseLayout, canvasSize, flowInstance, minZoom, viewport]);

  useEffect(() => {
    if (flowInstance === undefined || selectedNodeId === undefined) {
      return;
    }

    const selectedNode = baseLayout.nodes.find((node) => node.id === selectedNodeId);
    if (selectedNode === undefined) {
      return;
    }

    const currentZoom = flowInstance.getZoom();
    const targetZoom = Math.max(currentZoom, SELECTED_NODE_ZOOM);
    void flowInstance.setCenter(
      selectedNode.position.x + selectedNode.data.width / 2,
      selectedNode.position.y + selectedNode.data.height / 2,
      { zoom: targetZoom, duration: 360 }
    );
  }, [baseLayout.nodes, flowInstance, selectedNodeId]);

  const hoveredNode = decoratedLayout.nodes.find((node) => node.id === hoveredNodeId);

  return (
    <main className="graph-shell">
      <div
        ref={flowWrapRef}
        className="flow-wrap"
        style={
          {
            "--source-rail-width": `${baseLayout.sourceRailWidth}px`
          } as CSSProperties
        }
      >
        <button
          type="button"
          className="canvas-panel-toggle left"
          onClick={onToggleLeftPanel}
          aria-label={leftPanelCollapsed ? "Show search panel" : "Hide search panel"}
        >
          {leftPanelCollapsed ? ">" : "<"}
        </button>
        <button
          type="button"
          className="canvas-panel-toggle right"
          onClick={onToggleRightPanel}
          aria-label={rightPanelCollapsed ? "Show inspector panel" : "Hide inspector panel"}
        >
          {rightPanelCollapsed ? "<" : ">"}
        </button>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultViewport={DEFAULT_VIEWPORT}
          translateExtent={translateExtent}
          nodeExtent={nodeExtent}
          minZoom={minZoom}
          maxZoom={MAX_ZOOM}
          nodesDraggable={false}
          nodesConnectable={false}
          selectionOnDrag={false}
          selectNodesOnDrag={false}
          selectionKeyCode={null}
          multiSelectionKeyCode={null}
          deleteKeyCode={null}
          proOptions={{ hideAttribution: true }}
          onInit={(instance) => {
            setFlowInstance(instance);
            setViewport(instance.getViewport());
          }}
          onMove={(_, nextViewport) => setViewport(nextViewport)}
          onNodeClick={(_, node) => selectNode(node.id)}
          onPaneClick={clearSelection}
        >
          <SourceLaneLayer
            lanes={baseLayout.lanes}
            width={baseLayout.width}
            height={baseLayout.height}
          />
          <Controls position="bottom-left" showInteractive={false} />
        </ReactFlow>
        <FixedSourceRail
          lanes={baseLayout.lanes}
          width={baseLayout.sourceRailWidth}
          viewport={viewport}
        />
        {hoveredNode !== undefined && (
          <NodeHoverCardOverlay node={hoveredNode} viewport={viewport} />
        )}
        <div className="canvas-status">
          <span>{loading ? "Indexing..." : "Ready"}</span>
          {graph !== undefined && (
            <span>
              {visibleGraph.nodes.length} visible · {graph.nodes.length} total
            </span>
          )}
          {updatedAt !== undefined && (
            <span>Updated {new Date(updatedAt).toLocaleTimeString()}</span>
          )}
          {error !== undefined && <strong>{error}</strong>}
        </div>
      </div>
    </main>
  );
}
