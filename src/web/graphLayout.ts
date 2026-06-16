import ELK from "elkjs/lib/elk.bundled.js";
import type { ElkExtendedEdge, ElkNode } from "elkjs/lib/elk.bundled.js";
import { Position } from "@xyflow/react";
import type { TypeGraphEdge, TypeGraphNode } from "../shared/graphTypes.js";
import type { TypeGraphFlowEdge } from "./components/CanvasEdge.js";
import type { TypeGraphFlowNode } from "./components/NodeCard.js";

const elk = new ELK();

export const SOURCE_RAIL_FALLBACK_WIDTH = 80;
export const NODE_HEIGHT = 42;

const LANE_LEFT_PADDING = 120;
const LANE_RIGHT_PADDING = 360;
const LANE_TOP_PADDING = 58;
const LANE_BOTTOM_PADDING = 58;
const NODE_ROW_GAP = 84;
const X_SCALE = 1.42;
const MIN_NODE_WIDTH = 58;
const NODE_DOT_LABEL_GAP = 8;
const NODE_LABEL_RIGHT_PADDING = 4;
const NODE_LABEL_FONT =
  '690 12px Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const SOURCE_RAIL_LEFT_PADDING = 8;
const SOURCE_RAIL_RIGHT_PADDING = 8;
const SOURCE_RAIL_DIRECTORY_FONT =
  '560 11px Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const SOURCE_RAIL_FILE_FONT =
  '760 13px Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const SOURCE_RAIL_META_FONT =
  '560 11px Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

let textMeasureContext: CanvasRenderingContext2D | null | undefined;

const lanePalette = [
  { line: "hsl(166 55% 36%)", fill: "hsl(166 52% 94%)" },
  { line: "hsl(214 52% 43%)", fill: "hsl(214 58% 95%)" },
  { line: "hsl(38 65% 44%)", fill: "hsl(38 74% 94%)" },
  { line: "hsl(277 38% 48%)", fill: "hsl(277 54% 96%)" },
  { line: "hsl(350 48% 48%)", fill: "hsl(350 64% 96%)" },
  { line: "hsl(126 36% 40%)", fill: "hsl(126 46% 95%)" },
  { line: "hsl(190 52% 38%)", fill: "hsl(190 62% 95%)" },
  { line: "hsl(24 56% 44%)", fill: "hsl(24 70% 95%)" }
];
const fallbackLaneColor = lanePalette[0] ?? {
  line: "hsl(166 55% 36%)",
  fill: "hsl(166 52% 94%)"
};

export type SourceLane = {
  id: string;
  path: string;
  directory: string;
  fileName: string;
  color: string;
  fill: string;
  y: number;
  height: number;
  width: number;
  depth: number;
  nodeCount: number;
};

export type CanvasLayout = {
  nodes: TypeGraphFlowNode[];
  edges: TypeGraphFlowEdge[];
  lanes: SourceLane[];
  sourceRailWidth: number;
  width: number;
  height: number;
};

type LaneDraft = Omit<
  SourceLane,
  "color" | "fill" | "height" | "width" | "y" | "nodeCount"
> & {
  nodeIds: string[];
};

type ElkPosition = {
  x: number;
  y: number;
};

export const emptyCanvasLayout: CanvasLayout = {
  nodes: [],
  edges: [],
  lanes: [],
  sourceRailWidth: SOURCE_RAIL_FALLBACK_WIDTH,
  width: 1200,
  height: 800
};

function nodeSort(a: TypeGraphNode, b: TypeGraphNode): number {
  return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}

function estimatedTextWidth(text: string): number {
  let width = 0;

  for (const character of text) {
    if (/[ilI1.:,;|'`!]/.test(character)) {
      width += 3.8;
      continue;
    }

    if (/[mwMW@#%&]/.test(character)) {
      width += 9.2;
      continue;
    }

    if (/[A-Z]/.test(character)) {
      width += 7.4;
      continue;
    }

    width += 6.6;
  }

  return width;
}

function measuredTextWidth(text: string, font: string): number {
  if (textMeasureContext === undefined) {
    const canvas =
      typeof document === "undefined" ? undefined : document.createElement("canvas");
    textMeasureContext = canvas?.getContext("2d") ?? null;
  }

  if (textMeasureContext === null) {
    return estimatedTextWidth(text);
  }

  textMeasureContext.font = font;
  return textMeasureContext.measureText(text).width;
}

function nodeDotSize(node: TypeGraphNode): number {
  const connectionCount = node.dependsOn.length + node.dependedOnBy.length;
  return Math.min(18, 10 + Math.sqrt(connectionCount) * 1.8);
}

function nodeWidth(node: TypeGraphNode): number {
  return Math.ceil(
    Math.max(
      MIN_NODE_WIDTH,
      nodeDotSize(node) +
        NODE_DOT_LABEL_GAP +
        measuredTextWidth(node.name, NODE_LABEL_FONT) +
        NODE_LABEL_RIGHT_PADDING
    )
  );
}

function directoryName(filePath: string): string {
  const lastSlash = filePath.lastIndexOf("/");
  return lastSlash === -1 ? "." : filePath.slice(0, lastSlash);
}

function fileName(filePath: string): string {
  const lastSlash = filePath.lastIndexOf("/");
  return lastSlash === -1 ? filePath : filePath.slice(lastSlash + 1);
}

function lanePath(node: TypeGraphNode): string {
  if (node.relativeFilePath !== undefined) {
    return node.relativeFilePath.replaceAll("\\", "/");
  }

  if (node.kind === "primitive") {
    return "types/primitives";
  }

  if (node.kind === "external") {
    return "types/external";
  }

  return "types/unknown";
}

function laneDepth(path: string): number {
  return path.split("/").filter(Boolean).length - 1;
}

function sourceRailWidth(drafts: LaneDraft[]): number {
  const widestLabel = Math.max(
    0,
    ...drafts.map((draft) => {
      const nodeCountText = `${draft.nodeIds.length} nodes`;
      const labelWidth = Math.max(
        measuredTextWidth(draft.directory, SOURCE_RAIL_DIRECTORY_FONT),
        measuredTextWidth(draft.fileName, SOURCE_RAIL_FILE_FONT),
        measuredTextWidth(nodeCountText, SOURCE_RAIL_META_FONT)
      );

      return labelWidth;
    })
  );

  return Math.ceil(
    Math.max(
      SOURCE_RAIL_FALLBACK_WIDTH,
      SOURCE_RAIL_LEFT_PADDING + widestLabel + SOURCE_RAIL_RIGHT_PADDING
    )
  );
}

function buildLaneDrafts(nodes: TypeGraphNode[]): LaneDraft[] {
  const lanesByPath = new Map<string, LaneDraft>();

  for (const node of nodes) {
    const path = lanePath(node);
    const existing = lanesByPath.get(path);
    if (existing !== undefined) {
      existing.nodeIds.push(node.id);
      continue;
    }

    lanesByPath.set(path, {
      id: `lane:${path}`,
      path,
      directory: directoryName(path),
      fileName: fileName(path),
      depth: Math.max(0, laneDepth(path)),
      nodeIds: [node.id]
    });
  }

  return [...lanesByPath.values()].sort((left, right) =>
    left.path.localeCompare(right.path)
  );
}

function buildLanes(drafts: LaneDraft[], width: number): SourceLane[] {
  let y = 0;
  return drafts.map((draft, index) => {
    const palette = lanePalette[index % lanePalette.length] ?? fallbackLaneColor;
    const height = Math.max(
      178,
      LANE_TOP_PADDING + LANE_BOTTOM_PADDING + (draft.nodeIds.length - 1) * NODE_ROW_GAP + NODE_HEIGHT
    );
    const lane: SourceLane = {
      id: draft.id,
      path: draft.path,
      directory: draft.directory,
      fileName: draft.fileName,
      color: palette.line,
      fill: palette.fill,
      y,
      height,
      width,
      depth: draft.depth,
      nodeCount: draft.nodeIds.length
    };
    y += height;
    return lane;
  });
}

function buildElkGraph(nodes: TypeGraphNode[], edges: TypeGraphEdge[]): ElkNode {
  const elkNodes: ElkNode[] = nodes.map((node) => ({
    id: node.id,
    width: nodeWidth(node),
    height: NODE_HEIGHT
  }));
  const elkEdges: ElkExtendedEdge[] = edges.map((edge) => ({
    id: edge.id,
    sources: [edge.from],
    targets: [edge.to]
  }));

  return {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.edgeRouting": "SPLINES",
      "elk.spacing.nodeNode": "100",
      "elk.layered.spacing.nodeNodeBetweenLayers": "330",
      "elk.layered.spacing.edgeNodeBetweenLayers": "110",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX"
    },
    children: elkNodes,
    edges: elkEdges
  };
}

function elkPositions(layout: ElkNode): Map<string, ElkPosition> {
  return new Map(
    (layout.children ?? []).map((child) => [
      child.id,
      {
        x: child.x ?? 0,
        y: child.y ?? 0
      }
    ])
  );
}

function laneNodeOrder(
  draft: LaneDraft,
  nodesById: Map<string, TypeGraphNode>,
  positions: Map<string, ElkPosition>
): string[] {
  return [...draft.nodeIds].sort((left, right) => {
    const leftPosition = positions.get(left);
    const rightPosition = positions.get(right);
    if (leftPosition !== undefined && rightPosition !== undefined) {
      return (
        leftPosition.y - rightPosition.y ||
        leftPosition.x - rightPosition.x ||
        (nodesById.get(left)?.name ?? left).localeCompare(nodesById.get(right)?.name ?? right)
      );
    }

    const leftNode = nodesById.get(left);
    const rightNode = nodesById.get(right);
    if (leftNode !== undefined && rightNode !== undefined) {
      return nodeSort(leftNode, rightNode);
    }

    return left.localeCompare(right);
  });
}

function connectedNodeIds(edges: TypeGraphFlowEdge[], activeNodeId: string): Set<string> {
  const ids = new Set<string>([activeNodeId]);
  for (const edge of edges) {
    if (edge.source === activeNodeId) {
      ids.add(edge.target);
    }
    if (edge.target === activeNodeId) {
      ids.add(edge.source);
    }
  }
  return ids;
}

function edgeData(edge: TypeGraphFlowEdge) {
  return (
    edge.data ?? {
      color: "#4c5751",
      dimmed: false,
      focused: false
    }
  );
}

export async function buildCanvasLayout(
  visibleNodes: TypeGraphNode[],
  visibleEdges: TypeGraphEdge[]
): Promise<CanvasLayout> {
  if (visibleNodes.length === 0) {
    return emptyCanvasLayout;
  }

  const nodesById = new Map(visibleNodes.map((node) => [node.id, node]));
  const laneDrafts = buildLaneDrafts(visibleNodes);
  const sourceRailWidthValue = sourceRailWidth(laneDrafts);
  const layout = await elk.layout(buildElkGraph(visibleNodes, visibleEdges));
  const positions = elkPositions(layout);
  const minX = Math.min(...visibleNodes.map((node) => positions.get(node.id)?.x ?? 0));
  const maxRight = Math.max(
    ...visibleNodes.map((node) => {
      const position = positions.get(node.id);
      return (position?.x ?? 0) + nodeWidth(node);
    })
  );
  const width = Math.max(
    1600,
    sourceRailWidthValue + LANE_LEFT_PADDING + (maxRight - minX) * X_SCALE + LANE_RIGHT_PADDING
  );
  const lanes = buildLanes(laneDrafts, width);
  const lanesByPath = new Map(lanes.map((lane) => [lane.path, lane]));
  const laneColorsByPath = new Map(lanes.map((lane) => [lane.path, lane.color]));
  const flowNodes: TypeGraphFlowNode[] = [];

  for (const draft of laneDrafts) {
    const lane = lanesByPath.get(draft.path);
    if (lane === undefined) {
      continue;
    }

    const orderedIds = laneNodeOrder(draft, nodesById, positions);
    orderedIds.forEach((id, index) => {
      const graphNode = nodesById.get(id);
      if (graphNode === undefined) {
        return;
      }
      const position = positions.get(id) ?? { x: 0, y: 0 };
      const width = nodeWidth(graphNode);
      flowNodes.push({
        id,
        type: "typeGraphNode",
        position: {
          x: sourceRailWidthValue + LANE_LEFT_PADDING + (position.x - minX) * X_SCALE,
          y: lane.y + LANE_TOP_PADDING + index * NODE_ROW_GAP
        },
        style: {
          width,
          height: NODE_HEIGHT
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        data: {
          graphNode,
          selected: false,
          sourceColor: lane.color,
          dimmed: false,
          focused: false,
          hovered: false,
          width,
          height: NODE_HEIGHT
        }
      });
    });
  }

  const flowEdges: TypeGraphFlowEdge[] = visibleEdges.map((edge) => {
    const sourceNode = nodesById.get(edge.from);
    const edgeColor =
      sourceNode === undefined
        ? "#4c5751"
        : laneColorsByPath.get(lanePath(sourceNode)) ?? "#4c5751";

    return {
      id: edge.id,
      source: edge.from,
      target: edge.to,
      type: "canvasEdge",
      data: {
        color: edgeColor,
        dimmed: false,
        focused: false
      },
      className: "graph-edge canvas-edge"
    };
  });

  const height = Math.max(800, (lanes.at(-1)?.y ?? 0) + (lanes.at(-1)?.height ?? 0));

  return {
    nodes: flowNodes,
    edges: flowEdges,
    lanes,
    sourceRailWidth: sourceRailWidthValue,
    width,
    height
  };
}

export function decorateCanvasLayout(
  layout: CanvasLayout,
  selectedNodeId: string | undefined,
  hoveredNodeId: string | undefined
): Pick<CanvasLayout, "nodes" | "edges"> {
  const activeNodeId = hoveredNodeId ?? selectedNodeId;
  if (activeNodeId === undefined) {
    return {
      nodes: layout.nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          selected: node.id === selectedNodeId,
          dimmed: false,
          focused: false,
          hovered: node.id === hoveredNodeId
        }
      })),
      edges: layout.edges.map((edge) => ({
        ...edge,
        data: {
          ...edgeData(edge),
          dimmed: false,
          focused: false
        }
      }))
    };
  }

  const relatedNodeIds = connectedNodeIds(layout.edges, activeNodeId);
  return {
    nodes: layout.nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        selected: node.id === selectedNodeId,
        dimmed: !relatedNodeIds.has(node.id),
        focused: node.id === activeNodeId,
        hovered: node.id === hoveredNodeId
      }
    })),
    edges: layout.edges.map((edge) => {
      const focused = edge.source === activeNodeId || edge.target === activeNodeId;
      return {
        ...edge,
        data: {
          ...edgeData(edge),
          dimmed: !focused,
          focused
        }
      };
    })
  };
}
