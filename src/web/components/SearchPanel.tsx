import { useMemo } from "react";
import type { TypeGraphNode } from "../../shared/graphTypes.js";
import {
  kindLabel,
  nodeMatchesFilters,
  projectDisplayDetail,
  projectDisplayName,
  usageLabel
} from "../graphUi.js";
import { useGraphStore, type KindFilters } from "../state/graphStore.js";
import { ScopeSelector } from "./ScopeSelector.js";

function nodeSubtitle(node: TypeGraphNode): string {
  const location =
    node.relativeFilePath === undefined
      ? ""
      : ` · ${node.relativeFilePath}${node.startLine === undefined ? "" : `:${node.startLine}`}`;
  return `${kindLabel(node.kind)}${location}`;
}

export function SearchPanel() {
  const graph = useGraphStore((state) => state.graph);
  const selectedNodeId = useGraphStore((state) => state.selectedNodeId);
  const searchQuery = useGraphStore((state) => state.searchQuery);
  const showPrimitives = useGraphStore((state) => state.showPrimitives);
  const showExternal = useGraphStore((state) => state.showExternal);
  const exportedOnly = useGraphStore((state) => state.exportedOnly);
  const excludeTests = useGraphStore((state) => state.excludeTests);
  const excludeOrphans = useGraphStore((state) => state.excludeOrphans);
  const kindFilters = useGraphStore((state) => state.kindFilters);
  const setSearchQuery = useGraphStore((state) => state.setSearchQuery);
  const setShowPrimitives = useGraphStore((state) => state.setShowPrimitives);
  const setShowExternal = useGraphStore((state) => state.setShowExternal);
  const setExportedOnly = useGraphStore((state) => state.setExportedOnly);
  const setExcludeTests = useGraphStore((state) => state.setExcludeTests);
  const setExcludeOrphans = useGraphStore((state) => state.setExcludeOrphans);
  const toggleKind = useGraphStore((state) => state.toggleKind);
  const selectNode = useGraphStore((state) => state.selectNode);

  const results = useMemo(() => {
    if (graph === undefined) {
      return [];
    }

    return graph.nodes
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
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 120);
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
  const projectName = graph === undefined ? "Loading project" : projectDisplayName(graph);
  const projectDetail = graph === undefined ? undefined : projectDisplayDetail(graph);

  return (
    <aside className="panel left-panel">
      <div className="brand-block">
        <h1>TypeGraph</h1>
        <p title={projectName}>{projectName}</p>
        {projectDetail !== undefined && (
          <p className="brand-detail" title={projectDetail}>
            {projectDetail}
          </p>
        )}
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

      <div className="filter-section" aria-label="Graph filters">
        <span className="control-label">Filters</span>
        <div className="toggle-grid">
          <button
            type="button"
            aria-pressed={showPrimitives}
            onClick={() => setShowPrimitives(!showPrimitives)}
          >
            primitives
          </button>
          <button
            type="button"
            aria-pressed={showExternal}
            onClick={() => setShowExternal(!showExternal)}
          >
            external
          </button>
          <button
            type="button"
            aria-pressed={exportedOnly}
            onClick={() => setExportedOnly(!exportedOnly)}
          >
            exported
          </button>
          <button
            type="button"
            aria-pressed={excludeTests}
            onClick={() => setExcludeTests(!excludeTests)}
          >
            exclude test
          </button>
          <button
            type="button"
            aria-pressed={excludeOrphans}
            onClick={() => setExcludeOrphans(!excludeOrphans)}
          >
            exclude orphans
          </button>
        </div>
      </div>

      <div className="filter-section" aria-label="Kind filters">
        <span className="control-label">Kinds</span>
        <div className="toggle-grid kind-toggle-grid">
          {Object.keys(kindFilters).map((kind) => (
            <button
              key={kind}
              type="button"
              aria-pressed={kindFilters[kind as keyof KindFilters]}
              onClick={() => toggleKind(kind as keyof KindFilters)}
            >
              {kind === "typeAlias" ? "type" : kind}
            </button>
          ))}
        </div>
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
            <span>
              <b>{kindLabel(node.kind)}</b>
              {nodeSubtitle(node).slice(kindLabel(node.kind).length)}
            </span>
            <small>
              depends on <b>{node.dependsOn.length}</b> ·{" "}
              {node.dependedOnBy.length === 0 ? (
                usageLabel(node)
              ) : (
                <>
                  used by <b>{node.dependedOnBy.length}</b>
                </>
              )}
            </small>
          </button>
        ))}
      </div>
    </aside>
  );
}
