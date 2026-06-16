import type { TypeGraphNode, TypeGraphPayload } from "../shared/graphTypes.js";
import type { KindFilters } from "./state/graphStore.js";

export type GraphFilterOptions = {
  searchQuery: string;
  showPrimitives: boolean;
  showExternal: boolean;
  exportedOnly: boolean;
  excludeTests: boolean;
  excludeOrphans: boolean;
  kindFilters: KindFilters;
};

export function kindLabel(kind: TypeGraphNode["kind"]): string {
  return kind === "typeAlias" ? "type alias" : kind;
}

export function projectDirectoryName(projectRoot: string): string {
  const normalized = projectRoot.replaceAll("\\", "/").replace(/\/$/, "");
  const lastSlash = normalized.lastIndexOf("/");
  return lastSlash === -1 ? normalized : normalized.slice(lastSlash + 1);
}

export function nodeMatchesKind(
  node: TypeGraphNode,
  kindFilters: KindFilters
): boolean {
  if (node.kind === "primitive" || node.kind === "external") {
    return true;
  }

  return kindFilters[node.kind];
}

export function isRootNode(node: TypeGraphNode): boolean {
  return node.dependedOnBy.length === 0;
}

export function usageLabel(node: TypeGraphNode): string {
  return isRootNode(node) ? "root node" : `used by ${node.dependedOnBy.length}`;
}

function isTestNode(node: TypeGraphNode): boolean {
  const path = (node.relativeFilePath ?? node.filePath ?? "")
    .replaceAll("\\", "/")
    .toLowerCase();

  if (path === "") {
    return false;
  }

  return (
    /(^|\/)(__tests__|__test__|tests?|spec|specs|regression)(\/|$)/.test(path) ||
    /(^|[._-])(test|spec|regression)\.[jt]sx?$/.test(path) ||
    /(^|[._-])(test|spec|regression)([._-])/.test(path)
  );
}

function isDeclaredNode(node: TypeGraphNode): boolean {
  return node.kind !== "primitive" && node.kind !== "external";
}

function isOrphanNode(node: TypeGraphNode, graph: TypeGraphPayload): boolean {
  if (!node.isProjectLocal || !isDeclaredNode(node) || !isRootNode(node)) {
    return false;
  }

  const nodesById = new Map(graph.nodes.map((candidate) => [candidate.id, candidate]));
  return node.dependsOn.every((id) => {
    const dependency = nodesById.get(id);
    return dependency === undefined || !isDeclaredNode(dependency);
  });
}

export function nodeMatchesFilters(
  node: TypeGraphNode,
  graph: TypeGraphPayload,
  filters: GraphFilterOptions
): boolean {
  if (node.kind === "primitive" && !filters.showPrimitives) {
    return false;
  }

  if (node.kind === "external" && !filters.showExternal) {
    return false;
  }

  if (filters.exportedOnly && !node.exported) {
    return false;
  }

  if (filters.excludeTests && isTestNode(node)) {
    return false;
  }

  if (filters.excludeOrphans && isOrphanNode(node, graph)) {
    return false;
  }

  if (!nodeMatchesKind(node, filters.kindFilters)) {
    return false;
  }

  const query = filters.searchQuery.trim().toLowerCase();
  if (query === "") {
    return (
      node.isProjectLocal ||
      (node.kind === "primitive" && filters.showPrimitives) ||
      (node.kind === "external" && filters.showExternal)
    );
  }

  return (
    node.name.toLowerCase().includes(query) ||
    (node.relativeFilePath?.toLowerCase().includes(query) ?? false)
  );
}
