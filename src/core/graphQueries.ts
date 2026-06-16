import type {
  GraphSummary,
  TypeGraphEdge,
  TypeGraphNode,
  TypeGraphPayload
} from "../shared/graphTypes.js";
import type { NeighborhoodDirection } from "../shared/apiTypes.js";
import { summarizeGraph } from "./indexProject.js";

export function getNode(
  graph: TypeGraphPayload,
  nodeId: string
): TypeGraphNode | undefined {
  return graph.nodes.find((node) => node.id === nodeId);
}

export function requireNode(
  graph: TypeGraphPayload,
  nodeId: string
): TypeGraphNode {
  const node = getNode(graph, nodeId);
  if (node === undefined) {
    throw new Error(`Unknown graph node: ${nodeId}`);
  }
  return node;
}

export function searchNodes(
  graph: TypeGraphPayload,
  query: string,
  limit = 50
): TypeGraphNode[] {
  const normalized = query.trim().toLowerCase();
  const nodes = graph.nodes.filter((node) => node.isProjectLocal);

  if (normalized === "") {
    return [...nodes].sort((a, b) => a.name.localeCompare(b.name)).slice(0, limit);
  }

  return nodes
    .map((node) => {
      const name = node.name.toLowerCase();
      const file = node.relativeFilePath?.toLowerCase() ?? "";
      const exact = name === normalized ? 0 : 1;
      const starts = name.startsWith(normalized) ? 0 : 1;
      const includes = name.includes(normalized) || file.includes(normalized) ? 0 : 1;
      return { node, score: exact * 100 + starts * 10 + includes };
    })
    .filter((entry) => entry.score < 111)
    .sort((a, b) => a.score - b.score || a.node.name.localeCompare(b.node.name))
    .map((entry) => entry.node)
    .slice(0, limit);
}

export function getDependencies(
  graph: TypeGraphPayload,
  nodeId: string
): TypeGraphNode[] {
  const node = requireNode(graph, nodeId);
  return node.dependsOn.map((id) => requireNode(graph, id));
}

export function getDependents(
  graph: TypeGraphPayload,
  nodeId: string
): TypeGraphNode[] {
  const node = requireNode(graph, nodeId);
  return node.dependedOnBy.map((id) => requireNode(graph, id));
}

function walk(
  graph: TypeGraphPayload,
  startId: string,
  depth: number,
  direction: Exclude<NeighborhoodDirection, "both">,
  seen: Set<string>
): void {
  if (depth <= 0) {
    return;
  }

  const node = getNode(graph, startId);
  if (node === undefined) {
    return;
  }

  const nextIds = direction === "dependencies" ? node.dependsOn : node.dependedOnBy;
  for (const nextId of nextIds) {
    if (!seen.has(nextId)) {
      seen.add(nextId);
      walk(graph, nextId, depth - 1, direction, seen);
    }
  }
}

function subgraph(graph: TypeGraphPayload, nodeIds: Set<string>): TypeGraphPayload {
  const nodes = graph.nodes.filter((node) => nodeIds.has(node.id));
  const edges = graph.edges.filter(
    (edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to)
  );

  return {
    projectRoot: graph.projectRoot,
    tsconfigPath: graph.tsconfigPath,
    ...(graph.scopePath === undefined ? {} : { scopePath: graph.scopePath }),
    indexedAt: graph.indexedAt,
    nodes,
    edges
  };
}

export function getNeighborhood(
  graph: TypeGraphPayload,
  nodeId: string,
  depth: number,
  direction: NeighborhoodDirection
): TypeGraphPayload {
  requireNode(graph, nodeId);

  const seen = new Set<string>([nodeId]);
  if (direction === "dependencies" || direction === "both") {
    walk(graph, nodeId, depth, "dependencies", seen);
  }
  if (direction === "dependents" || direction === "both") {
    walk(graph, nodeId, depth, "dependents", seen);
  }

  return subgraph(graph, seen);
}

export function getEdgesBetween(
  graph: TypeGraphPayload,
  fromId: string,
  toId: string
): TypeGraphEdge[] {
  return graph.edges.filter((edge) => edge.from === fromId && edge.to === toId);
}

export function graphSummary(graph: TypeGraphPayload): GraphSummary {
  return summarizeGraph(graph);
}
