import { useMemo } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type NodeTypes
} from "@xyflow/react";
import type { TypeGraphNode, TypeGraphPayload } from "../../shared/graphTypes.js";
import { useGraphStore } from "../state/graphStore.js";
import { NodeCard, type TypeGraphFlowNode } from "./NodeCard.js";

const nodeTypes: NodeTypes = {
  typeGraphNode: NodeCard
};

type LevelNode = {
  node: TypeGraphNode;
  level: number;
};

function visibleTerminal(node: TypeGraphNode, showPrimitives: boolean, showExternal: boolean): boolean {
  if (node.kind === "primitive") {
    return showPrimitives;
  }

  if (node.kind === "external") {
    return showExternal;
  }

  return true;
}

function collectDirection(
  graph: TypeGraphPayload,
  selected: TypeGraphNode,
  depth: number,
  direction: "dependencies" | "dependents"
): LevelNode[] {
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const output: LevelNode[] = [];
  const seen = new Set<string>([selected.id]);
  let frontier = [selected.id];

  for (let level = 1; level <= depth; level += 1) {
    const next: string[] = [];
    for (const id of frontier) {
      const node = nodesById.get(id);
      if (node === undefined) {
        continue;
      }

      const ids = direction === "dependencies" ? node.dependsOn : node.dependedOnBy;
      for (const nextId of ids) {
        if (seen.has(nextId)) {
          continue;
        }
        const nextNode = nodesById.get(nextId);
        if (nextNode !== undefined) {
          seen.add(nextId);
          next.push(nextId);
          output.push({ node: nextNode, level });
        }
      }
    }
    frontier = next;
  }

  return output;
}

function layoutColumn(
  entries: LevelNode[],
  side: "left" | "right",
  showPrimitives: boolean,
  showExternal: boolean
): TypeGraphFlowNode[] {
  const byLevel = new Map<number, TypeGraphNode[]>();
  for (const entry of entries) {
    if (!visibleTerminal(entry.node, showPrimitives, showExternal)) {
      continue;
    }
    const level = byLevel.get(entry.level) ?? [];
    level.push(entry.node);
    byLevel.set(entry.level, level);
  }

  const flowNodes: TypeGraphFlowNode[] = [];
  for (const [level, nodes] of byLevel.entries()) {
    const x = side === "left" ? -320 * level : 320 * level;
    nodes.forEach((node, index) => {
      flowNodes.push({
        id: node.id,
        type: "typeGraphNode",
        position: {
          x,
          y: (index - (nodes.length - 1) / 2) * 118
        },
        data: {
          graphNode: node,
          selected: false
        }
      });
    });
  }

  return flowNodes;
}

export function GraphCanvas() {
  const graph = useGraphStore((state) => state.graph);
  const selectedNodeId = useGraphStore((state) => state.selectedNodeId);
  const showPrimitives = useGraphStore((state) => state.showPrimitives);
  const showExternal = useGraphStore((state) => state.showExternal);
  const dependencyDepth = useGraphStore((state) => state.dependencyDepth);
  const dependentDepth = useGraphStore((state) => state.dependentDepth);
  const setDependencyDepth = useGraphStore((state) => state.setDependencyDepth);
  const setDependentDepth = useGraphStore((state) => state.setDependentDepth);

  const selectedNode = graph?.nodes.find((node) => node.id === selectedNodeId);

  const { nodes, edges } = useMemo(() => {
    if (graph === undefined || selectedNode === undefined) {
      return { nodes: [], edges: [] };
    }

    const dependencies = collectDirection(
      graph,
      selectedNode,
      dependencyDepth,
      "dependencies"
    );
    const dependents = collectDirection(
      graph,
      selectedNode,
      dependentDepth,
      "dependents"
    );

    const flowNodes: TypeGraphFlowNode[] = [
      ...layoutColumn(dependents, "left", showPrimitives, showExternal),
      {
        id: selectedNode.id,
        type: "typeGraphNode",
        position: { x: 0, y: 0 },
        data: {
          graphNode: selectedNode,
          selected: true
        }
      },
      ...layoutColumn(dependencies, "right", showPrimitives, showExternal)
    ];
    const visibleIds = new Set(flowNodes.map((node) => node.id));
    const flowEdges: Edge[] = graph.edges
      .filter((edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to))
      .map((edge) => ({
        id: edge.id,
        source: edge.from,
        target: edge.to,
        label: edge.via,
        animated: edge.from === selectedNode.id || edge.to === selectedNode.id,
        className: `edge-${edge.kind}`
      }));

    return { nodes: flowNodes, edges: flowEdges };
  }, [
    dependencyDepth,
    dependentDepth,
    graph,
    selectedNode,
    showExternal,
    showPrimitives
  ]);

  return (
    <main className="graph-shell">
      <div className="graph-toolbar">
        <div>
          <strong>{selectedNode?.name ?? "No node selected"}</strong>
          <span>focused neighborhood</span>
        </div>
        <div className="toolbar-actions">
          <button
            type="button"
            onClick={() => setDependentDepth(dependentDepth + 1)}
          >
            expand used by
          </button>
          <button
            type="button"
            onClick={() => setDependencyDepth(dependencyDepth + 1)}
          >
            expand depends on
          </button>
          <button
            type="button"
            onClick={() => {
              setDependentDepth(1);
              setDependencyDepth(1);
            }}
          >
            reset
          </button>
        </div>
      </div>
      <div className="flow-wrap">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.35}
          maxZoom={1.6}
        >
          <Background gap={22} size={1} />
          <MiniMap pannable zoomable />
          <Controls />
        </ReactFlow>
      </div>
    </main>
  );
}
