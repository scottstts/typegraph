import { create } from "zustand";
import type {
  TypeGraphNodeKind,
  TypeGraphPayload
} from "../../shared/graphTypes.js";
import { fetchGraph, updateScope } from "../api/client.js";

export type KindFilters = Record<Exclude<TypeGraphNodeKind, "primitive" | "external">, boolean>;

export type GraphStore = {
  graph: TypeGraphPayload | undefined;
  selectedNodeId: string | undefined;
  searchQuery: string;
  showPrimitives: boolean;
  showExternal: boolean;
  exportedOnly: boolean;
  excludeTests: boolean;
  excludeOrphans: boolean;
  kindFilters: KindFilters;
  dependencyDepth: number;
  dependentDepth: number;
  loading: boolean;
  error: string | undefined;
  updatedAt: string | undefined;

  loadGraph: () => Promise<void>;
  applyScope: (scopePath: string | undefined) => Promise<void>;
  selectNode: (nodeId: string) => void;
  clearSelection: () => void;
  setSearchQuery: (query: string) => void;
  setShowPrimitives: (value: boolean) => void;
  setShowExternal: (value: boolean) => void;
  setExportedOnly: (value: boolean) => void;
  setExcludeTests: (value: boolean) => void;
  setExcludeOrphans: (value: boolean) => void;
  toggleKind: (kind: keyof KindFilters) => void;
  setDependencyDepth: (depth: number) => void;
  setDependentDepth: (depth: number) => void;
};

const defaultKindFilters: KindFilters = {
  typeAlias: true,
  interface: true,
  class: true,
  enum: true
};

function selectedIfPresent(
  graph: TypeGraphPayload,
  selectedNodeId: string | undefined
): string | undefined {
  if (
    selectedNodeId !== undefined &&
    graph.nodes.some((node) => node.id === selectedNodeId)
  ) {
    return selectedNodeId;
  }

  return undefined;
}

export const useGraphStore = create<GraphStore>((set, get) => ({
  searchQuery: "",
  showPrimitives: false,
  showExternal: false,
  exportedOnly: false,
  excludeTests: true,
  excludeOrphans: true,
  kindFilters: defaultKindFilters,
  dependencyDepth: 1,
  dependentDepth: 1,
  loading: false,
  graph: undefined,
  selectedNodeId: undefined,
  error: undefined,
  updatedAt: undefined,

  loadGraph: async () => {
    set({ loading: true, error: undefined });
    try {
      const graph = await fetchGraph();
      set({
        graph,
        selectedNodeId: selectedIfPresent(graph, get().selectedNodeId),
        loading: false,
        updatedAt: graph.indexedAt
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
        loading: false
      });
    }
  },

  applyScope: async (scopePath) => {
    set({ loading: true, error: undefined });
    try {
      const response = await updateScope(scopePath);
      set({
        graph: response.graph,
        selectedNodeId: selectedIfPresent(response.graph, get().selectedNodeId),
        loading: false,
        updatedAt: response.graph.indexedAt
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
        loading: false
      });
    }
  },

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),
  clearSelection: () => set({ selectedNodeId: undefined }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setShowPrimitives: (showPrimitives) => set({ showPrimitives }),
  setShowExternal: (showExternal) => set({ showExternal }),
  setExportedOnly: (exportedOnly) => set({ exportedOnly }),
  setExcludeTests: (excludeTests) => set({ excludeTests }),
  setExcludeOrphans: (excludeOrphans) => set({ excludeOrphans }),
  toggleKind: (kind) =>
    set((state) => ({
      kindFilters: {
        ...state.kindFilters,
        [kind]: !state.kindFilters[kind]
      }
    })),
  setDependencyDepth: (depth) => set({ dependencyDepth: Math.max(0, Math.min(depth, 5)) }),
  setDependentDepth: (depth) => set({ dependentDepth: Math.max(0, Math.min(depth, 5)) })
}));
