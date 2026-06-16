import type {
  ProjectInfo,
  TypeGraphNode,
  TypeGraphPayload
} from "./graphTypes.js";

export type ProjectResponse = ProjectInfo;

export type GraphResponse = TypeGraphPayload;

export type NodeResponse = {
  node: TypeGraphNode;
};

export type SearchResponse = {
  results: TypeGraphNode[];
};

export type NeighborhoodDirection = "dependencies" | "dependents" | "both";

export type NeighborhoodResponse = {
  centerNodeId: string;
  depth: number;
  direction: NeighborhoodDirection;
  graph: TypeGraphPayload;
};

export type ScopeRequest = {
  scopePath?: string;
};

export type ScopeResponse = {
  graph: TypeGraphPayload;
};

export type SourceResponse = {
  nodeId: string;
  sourceText: string;
};

export type GraphUpdatedEvent = {
  type: "graph-updated";
  indexedAt: string;
  nodeCount: number;
  edgeCount: number;
  preservedNodeId?: string;
};

