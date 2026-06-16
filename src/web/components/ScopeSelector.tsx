import { useMemo } from "react";
import { useGraphStore } from "../state/graphStore.js";

type ScopeOption = {
  label: string;
  value?: string;
};

function relativeDirectory(projectRoot: string, filePath: string): string {
  const root = projectRoot.replaceAll("\\", "/").replace(/\/$/, "");
  const directory = directoryName(filePath);
  const relative = directory.startsWith(root)
    ? directory.slice(root.length).replace(/^\//, "")
    : directory;
  return relative === "" ? "." : relative;
}

function directoryName(filePath: string): string {
  const normalized = filePath.replaceAll("\\", "/");
  const lastSlash = normalized.lastIndexOf("/");
  return lastSlash === -1 ? "." : normalized.slice(0, lastSlash);
}

export function ScopeSelector() {
  const graph = useGraphStore((state) => state.graph);
  const applyScope = useGraphStore((state) => state.applyScope);

  const options = useMemo<ScopeOption[]>(() => {
    if (graph === undefined) {
      return [{ label: "Whole project" }];
    }

    const directories = new Map<string, string>();
    for (const node of graph.nodes) {
      if (node.filePath !== undefined && node.isProjectLocal) {
        directories.set(
          relativeDirectory(graph.projectRoot, node.filePath),
          directoryName(node.filePath)
        );
      }
    }

    return [
      { label: "Whole project" },
      ...[...directories.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, value]) => ({ label, value }))
    ];
  }, [graph]);

  const currentValue = graph?.scopePath ?? "";

  return (
    <label className="field">
      <span>Scope</span>
      <span className="select-wrap">
        <select
          value={currentValue}
          onChange={(event) => {
            const value = event.currentTarget.value;
            void applyScope(value === "" ? undefined : value);
          }}
        >
          {options.map((option) => (
            <option key={option.value ?? "all"} value={option.value ?? ""}>
              {option.label}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}
