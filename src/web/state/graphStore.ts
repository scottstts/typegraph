import { create } from "zustand";
import type {
  TypeGraphNode,
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
  currentDirectoryOnly: boolean;
  kindFilters: KindFilters;
  dependencyDepth: number;
  dependentDepth: number;
  loading: boolean;
  error: string | undefined;
  updatedAt: string | undefined;

  loadGraph: () => Promise<void>;
  applyScope: (scopePath: string | undefined) => Promise<void>;
  selectNode: (nodeId: string) => void;
  setSearchQuery: (query: string) => void;
  setShowPrimitives: (value: boolean) => void;
  setShowExternal: (value: boolean) => void;
  setExportedOnly: (value: boolean) => void;
  setCurrentDirectoryOnly: (value: boolean) => void;
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

function firstProjectNode(graph: TypeGraphPayload): TypeGraphNode | undefined {
  return graph.nodes.find((node) => node.isProjectLocal);
}

function selectedOrFirst(
  graph: TypeGraphPayload,
  selectedNodeId: string | undefined
): string | undefined {
  if (
    selectedNodeId !== undefined &&
    graph.nodes.some((node) => node.id === selectedNodeId)
  ) {
    return selectedNodeId;
  }

  return firstProjectNode(graph)?.id;
}

export const useGraphStore = create<GraphStore>((set, get) => ({
  searchQuery: "",
  showPrimitives: false,
  showExternal: false,
  exportedOnly: false,
  currentDirectoryOnly: false,
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
        selectedNodeId: selectedOrFirst(graph, get().selectedNodeId),
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
        selectedNodeId: selectedOrFirst(response.graph, get().selectedNodeId),
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
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setShowPrimitives: (showPrimitives) => set({ showPrimitives }),
  setShowExternal: (showExternal) => set({ showExternal }),
  setExportedOnly: (exportedOnly) => set({ exportedOnly }),
  setCurrentDirectoryOnly: (currentDirectoryOnly) => set({ currentDirectoryOnly }),
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
