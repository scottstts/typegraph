import { useMemo } from "react";
import type { TypeGraphNode } from "../../shared/graphTypes.js";
import { useGraphStore, type KindFilters } from "../state/graphStore.js";
import { ScopeSelector } from "./ScopeSelector.js";

function nodeMatchesKind(node: TypeGraphNode, kindFilters: KindFilters): boolean {
  if (node.kind === "primitive" || node.kind === "external") {
    return true;
  }

  return kindFilters[node.kind];
}

function nodeSubtitle(node: TypeGraphNode): string {
  const kind = node.kind === "typeAlias" ? "type alias" : node.kind;
  const location =
    node.relativeFilePath === undefined
      ? ""
      : ` · ${node.relativeFilePath}${node.startLine === undefined ? "" : `:${node.startLine}`}`;
  return `${kind}${location}`;
}

function isNodeInScope(node: TypeGraphNode, scopePath: string | undefined): boolean {
  if (scopePath === undefined) {
    return true;
  }

  if (!node.isProjectLocal || node.filePath === undefined) {
    return false;
  }

  const scope = scopePath.replaceAll("\\", "/").replace(/\/$/, "");
  const filePath = node.filePath.replaceAll("\\", "/");
  return filePath === scope || filePath.startsWith(`${scope}/`);
}

export function SearchPanel() {
  const graph = useGraphStore((state) => state.graph);
  const selectedNodeId = useGraphStore((state) => state.selectedNodeId);
  const searchQuery = useGraphStore((state) => state.searchQuery);
  const showPrimitives = useGraphStore((state) => state.showPrimitives);
  const showExternal = useGraphStore((state) => state.showExternal);
  const exportedOnly = useGraphStore((state) => state.exportedOnly);
  const currentDirectoryOnly = useGraphStore((state) => state.currentDirectoryOnly);
  const kindFilters = useGraphStore((state) => state.kindFilters);
  const setSearchQuery = useGraphStore((state) => state.setSearchQuery);
  const setShowPrimitives = useGraphStore((state) => state.setShowPrimitives);
  const setShowExternal = useGraphStore((state) => state.setShowExternal);
  const setExportedOnly = useGraphStore((state) => state.setExportedOnly);
  const setCurrentDirectoryOnly = useGraphStore(
    (state) => state.setCurrentDirectoryOnly
  );
  const toggleKind = useGraphStore((state) => state.toggleKind);
  const selectNode = useGraphStore((state) => state.selectNode);

  const results = useMemo(() => {
    if (graph === undefined) {
      return [];
    }

    const query = searchQuery.trim().toLowerCase();
    return graph.nodes
      .filter((node) => {
        if (node.kind === "primitive" && !showPrimitives) {
          return false;
        }
        if (node.kind === "external" && !showExternal) {
          return false;
        }
        if (exportedOnly && !node.exported) {
          return false;
        }
        if (currentDirectoryOnly && !isNodeInScope(node, graph.scopePath)) {
          return false;
        }
        if (!nodeMatchesKind(node, kindFilters)) {
          return false;
        }
        if (query === "") {
          return node.isProjectLocal;
        }
        return (
          node.name.toLowerCase().includes(query) ||
          (node.relativeFilePath?.toLowerCase().includes(query) ?? false)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 120);
  }, [
    currentDirectoryOnly,
    exportedOnly,
    graph,
    kindFilters,
    searchQuery,
    showExternal,
    showPrimitives
  ]);

  return (
    <aside className="panel left-panel">
      <div className="brand-block">
        <h1>TypeGraph</h1>
        <p>{graph?.projectRoot ?? "Loading project"}</p>
      </div>

      <label className="field">
        <span>Search</span>
        <input
          value={searchQuery}
          placeholder="Type name or file path"
          onChange={(event) => setSearchQuery(event.currentTarget.value)}
        />
      </label>

      <ScopeSelector />

      <div className="filter-grid" aria-label="Graph filters">
        <label>
          <input
            type="checkbox"
            checked={showPrimitives}
            onChange={(event) => setShowPrimitives(event.currentTarget.checked)}
          />
          primitives
        </label>
        <label>
          <input
            type="checkbox"
            checked={showExternal}
            onChange={(event) => setShowExternal(event.currentTarget.checked)}
          />
          external
        </label>
        <label>
          <input
            type="checkbox"
            checked={exportedOnly}
            onChange={(event) => setExportedOnly(event.currentTarget.checked)}
          />
          exported
        </label>
        <label>
          <input
            type="checkbox"
            checked={currentDirectoryOnly}
            onChange={(event) =>
              setCurrentDirectoryOnly(event.currentTarget.checked)
            }
          />
          current dir
        </label>
      </div>

      <div className="kind-row" aria-label="Kind filters">
        {Object.keys(kindFilters).map((kind) => (
          <button
            key={kind}
            className={kindFilters[kind as keyof KindFilters] ? "active" : ""}
            type="button"
            onClick={() => toggleKind(kind as keyof KindFilters)}
          >
            {kind === "typeAlias" ? "type" : kind}
          </button>
        ))}
      </div>

      <div className="result-list">
        {results.map((node) => (
          <button
            key={node.id}
            className={node.id === selectedNodeId ? "result active" : "result"}
            type="button"
            onClick={() => selectNode(node.id)}
          >
            <strong>{node.name}</strong>
            <span>{nodeSubtitle(node)}</span>
            <small>
              depends on {node.dependsOn.length} · used by {node.dependedOnBy.length}
            </small>
          </button>
        ))}
      </div>
    </aside>
  );
}
