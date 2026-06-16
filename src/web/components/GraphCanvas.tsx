import { useMemo } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  type Edge,
  type NodeTypes
} from "@xyflow/react";
import type {
  TypeGraphEdge,
  TypeGraphNode
} from "../../shared/graphTypes.js";
import { nodeMatchesFilters } from "../graphUi.js";
import { useGraphStore } from "../state/graphStore.js";
import { NodeCard, type TypeGraphFlowNode } from "./NodeCard.js";

const nodeTypes: NodeTypes = {
  typeGraphNode: NodeCard
};

const COMPONENT_ROW_WIDTH = 2300;
const COMPONENT_GAP_X = 180;
const COMPONENT_GAP_Y = 130;
const LEVEL_GAP_X = 132;
const NODE_GAP_Y = 52;

type LaidOutGraph = {
  nodes: TypeGraphFlowNode[];
  edges: Edge[];
};

type ComponentLayout = {
  ids: string[];
  positions: Map<string, { x: number; y: number }>;
  width: number;
  height: number;
  name: string;
};

function nodeSort(a: TypeGraphNode, b: TypeGraphNode): number {
  return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}

function nodeDegree(node: TypeGraphNode): number {
  return node.dependsOn.length + node.dependedOnBy.length;
}

function deterministicJitter(id: string, amplitude: number): number {
  let hash = 0;
  for (const character of id) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return ((hash % 1000) / 1000 - 0.5) * amplitude;
}

function buildComponents(nodes: TypeGraphNode[], edges: TypeGraphEdge[]): string[][] {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const adjacency = new Map(nodes.map((node) => [node.id, new Set<string>()]));

  for (const edge of edges) {
    adjacency.get(edge.from)?.add(edge.to);
    adjacency.get(edge.to)?.add(edge.from);
  }

  const components: string[][] = [];
  const seen = new Set<string>();

  for (const node of [...nodes].sort(nodeSort)) {
    if (seen.has(node.id)) {
      continue;
    }

    const component: string[] = [];
    const queue = [node.id];
    seen.add(node.id);

    let queueIndex = 0;
    while (queueIndex < queue.length) {
      const id = queue[queueIndex];
      queueIndex += 1;
      if (id === undefined) {
        continue;
      }
      component.push(id);
      const neighbors = [...(adjacency.get(id) ?? [])].sort((left, right) => {
        const leftNode = nodesById.get(left);
        const rightNode = nodesById.get(right);
        if (leftNode === undefined || rightNode === undefined) {
          return left.localeCompare(right);
        }
        return nodeSort(leftNode, rightNode);
      });

      for (const nextId of neighbors) {
        if (!seen.has(nextId)) {
          seen.add(nextId);
          queue.push(nextId);
        }
      }
    }

    components.push(component);
  }

  return components.sort((left, right) => {
    if (right.length !== left.length) {
      return right.length - left.length;
    }
    const leftFirstId = left[0] ?? "";
    const rightFirstId = right[0] ?? "";
    const leftName = nodesById.get(leftFirstId)?.name ?? leftFirstId;
    const rightName = nodesById.get(rightFirstId)?.name ?? rightFirstId;
    return leftName.localeCompare(rightName);
  });
}

function assignLevels(
  componentIds: string[],
  edges: TypeGraphEdge[],
  nodesById: Map<string, TypeGraphNode>
): Map<string, number> {
  const componentIdSet = new Set(componentIds);
  const outgoing = new Map(componentIds.map((id) => [id, [] as string[]]));
  const incomingCount = new Map(componentIds.map((id) => [id, 0]));

  for (const edge of edges) {
    if (!componentIdSet.has(edge.from) || !componentIdSet.has(edge.to)) {
      continue;
    }

    outgoing.get(edge.from)?.push(edge.to);
    incomingCount.set(edge.to, (incomingCount.get(edge.to) ?? 0) + 1);
  }

  for (const targets of outgoing.values()) {
    targets.sort((left, right) => {
      const leftNode = nodesById.get(left);
      const rightNode = nodesById.get(right);
      if (leftNode === undefined || rightNode === undefined) {
        return left.localeCompare(right);
      }
      return nodeSort(leftNode, rightNode);
    });
  }

  const sortedIds = [...componentIds].sort((left, right) => {
    const leftNode = nodesById.get(left);
    const rightNode = nodesById.get(right);
    if (leftNode === undefined || rightNode === undefined) {
      return left.localeCompare(right);
    }
    return nodeDegree(rightNode) - nodeDegree(leftNode) || nodeSort(leftNode, rightNode);
  });

  const roots = sortedIds.filter((id) => incomingCount.get(id) === 0);
  const seedIds = roots.length > 0 ? roots : sortedIds.slice(0, 1);
  const levels = new Map<string, number>();
  const queue: string[] = [];

  for (const id of seedIds) {
    levels.set(id, 0);
    queue.push(id);
  }

  let queueIndex = 0;
  while (queueIndex < queue.length) {
    const id = queue[queueIndex];
    queueIndex += 1;
    if (id === undefined) {
      continue;
    }
    const level = levels.get(id) ?? 0;
    for (const targetId of outgoing.get(id) ?? []) {
      if (!levels.has(targetId)) {
        levels.set(targetId, level + 1);
        queue.push(targetId);
      }
    }
  }

  for (const id of sortedIds) {
    if (!levels.has(id)) {
      levels.set(id, 0);
    }
  }

  return levels;
}

function layoutComponent(
  ids: string[],
  edges: TypeGraphEdge[],
  nodesById: Map<string, TypeGraphNode>
): ComponentLayout {
  const levels = assignLevels(ids, edges, nodesById);
  const byLevel = new Map<number, string[]>();

  for (const id of ids) {
    const level = levels.get(id) ?? 0;
    const column = byLevel.get(level) ?? [];
    column.push(id);
    byLevel.set(level, column);
  }

  for (const column of byLevel.values()) {
    column.sort((left, right) => {
      const leftNode = nodesById.get(left);
      const rightNode = nodesById.get(right);
      if (leftNode === undefined || rightNode === undefined) {
        return left.localeCompare(right);
      }
      return nodeDegree(rightNode) - nodeDegree(leftNode) || nodeSort(leftNode, rightNode);
    });
  }

  const orderedLevels = [...byLevel.keys()].sort((a, b) => a - b);
  const maxColumnSize = Math.max(...[...byLevel.values()].map((column) => column.length));
  const width = Math.max(90, (orderedLevels.length - 1) * LEVEL_GAP_X + 90);
  const height = Math.max(90, (maxColumnSize - 1) * NODE_GAP_Y + 90);
  const positions = new Map<string, { x: number; y: number }>();

  orderedLevels.forEach((level, levelIndex) => {
    const column = byLevel.get(level) ?? [];
    const columnHeight = (column.length - 1) * NODE_GAP_Y;
    column.forEach((id, index) => {
      positions.set(id, {
        x: levelIndex * LEVEL_GAP_X + deterministicJitter(id, 12),
        y: index * NODE_GAP_Y - columnHeight / 2 + deterministicJitter(id, 16)
      });
    });
  });

  const names = ids
    .map((id) => nodesById.get(id)?.name ?? id)
    .sort((left, right) => left.localeCompare(right));

  return {
    ids,
    positions,
    width,
    height,
    name: names[0] ?? ""
  };
}

function layoutVisibleGraph(
  visibleNodes: TypeGraphNode[],
  visibleEdges: TypeGraphEdge[],
  selectedNodeId: string | undefined
): LaidOutGraph {
  const nodesById = new Map(visibleNodes.map((node) => [node.id, node]));
  const componentLayouts = buildComponents(visibleNodes, visibleEdges)
    .map((componentIds) => layoutComponent(componentIds, visibleEdges, nodesById))
    .sort((left, right) => right.ids.length - left.ids.length || left.name.localeCompare(right.name));

  const positions = new Map<string, { x: number; y: number }>();
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;

  for (const component of componentLayouts) {
    if (cursorX > 0 && cursorX + component.width > COMPONENT_ROW_WIDTH) {
      cursorX = 0;
      cursorY += rowHeight + COMPONENT_GAP_Y;
      rowHeight = 0;
    }

    for (const [id, position] of component.positions) {
      positions.set(id, {
        x: cursorX + position.x,
        y: cursorY + component.height / 2 + position.y
      });
    }

    cursorX += component.width + COMPONENT_GAP_X;
    rowHeight = Math.max(rowHeight, component.height);
  }

  const nodes: TypeGraphFlowNode[] = visibleNodes.map((node) => ({
    id: node.id,
    type: "typeGraphNode",
    position: positions.get(node.id) ?? { x: 0, y: 0 },
    data: {
      graphNode: node,
      selected: node.id === selectedNodeId
    }
  }));

  const edges: Edge[] = visibleEdges.map((edge) => ({
    id: edge.id,
    source: edge.from,
    target: edge.to,
    type: "smoothstep",
    className:
      edge.from === selectedNodeId || edge.to === selectedNodeId
        ? `graph-edge edge-${edge.kind} selected`
        : `graph-edge edge-${edge.kind}`
  }));

  return {
    nodes,
    edges
  };
}

export function GraphCanvas() {
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

  const { nodes, edges } = useMemo(() => {
    if (graph === undefined) {
      return { nodes: [], edges: [] };
    }

    const visibleNodes = graph.nodes
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
      .sort(nodeSort);
    const visibleIds = new Set(visibleNodes.map((node) => node.id));
    const visibleEdges = graph.edges.filter(
      (edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to)
    );

    return layoutVisibleGraph(visibleNodes, visibleEdges, selectedNodeId);
  }, [
    excludeOrphans,
    excludeTests,
    exportedOnly,
    graph,
    kindFilters,
    searchQuery,
    selectedNodeId,
    showExternal,
    showPrimitives
  ]);

  return (
    <main className="graph-shell">
      <div className="flow-wrap">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.16 }}
          minZoom={0.12}
          maxZoom={2}
          nodesDraggable={false}
          nodesConnectable={false}
          proOptions={{ hideAttribution: true }}
          onNodeClick={(_, node) => selectNode(node.id)}
          onPaneClick={clearSelection}
        >
          <Background color="#c8cec7" gap={24} size={1} />
          <Controls position="bottom-left" showInteractive={false} />
        </ReactFlow>
        <div className="canvas-status">
          <span>{loading ? "Indexing..." : "Ready"}</span>
          {graph !== undefined && (
            <span>
              {graph.nodes.length} nodes · {graph.edges.length} edges
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
