import type { PRIMITIVE_TYPE_NAMES } from "./constants.js";

export type TypeGraphNodeKind =
  | "typeAlias"
  | "interface"
  | "class"
  | "enum"
  | "primitive"
  | "external";

export type TypeGraphMemberKind =
  | "property"
  | "method"
  | "callSignature"
  | "constructSignature"
  | "indexSignature"
  | "unionMember"
  | "intersectionMember"
  | "tupleElement"
  | "functionParam"
  | "functionReturn";

export type TypeGraphEdgeKind =
  | "property"
  | "method"
  | "callSignature"
  | "constructSignature"
  | "indexSignature"
  | "functionParam"
  | "functionReturn"
  | "extends"
  | "implements"
  | "union"
  | "intersection"
  | "genericArg"
  | "arrayElement"
  | "tupleElement";

export type PrimitiveTypeName = (typeof PRIMITIVE_TYPE_NAMES)[number];

export type TypeGraphMember = {
  name: string;
  optional: boolean;
  readonly: boolean;
  displayType: string;
  referencedTypeIds: string[];
  kind: TypeGraphMemberKind;
};

export type TypeGraphNode = {
  id: string;
  name: string;
  kind: TypeGraphNodeKind;

  filePath?: string;
  relativeFilePath?: string;
  startLine?: number;
  startColumn?: number;
  endLine?: number;
  endColumn?: number;

  exported: boolean;
  sourceText?: string;

  displayText: string;
  members: TypeGraphMember[];

  dependsOn: string[];
  dependedOnBy: string[];

  scopePath?: string;
  isProjectLocal: boolean;
  isPrimitiveLike: boolean;
  isExternal: boolean;
};

export type TypeGraphEdge = {
  id: string;
  from: string;
  to: string;
  via: string;
  kind: TypeGraphEdgeKind;
};

export type GitHubGraphSource = {
  kind: "github";
  owner: string;
  repo: string;
  ref: string;
  defaultBranch: string;
  scopePath?: string;
  url: string;
};

export type TypeGraphSource = GitHubGraphSource;

export type GraphScope = {
  projectRoot: string;
  scopePath?: string;
};

export type TypeGraphPayload = {
  projectRoot: string;
  tsconfigPath: string;
  scopePath?: string;
  indexedAt: string;
  source?: TypeGraphSource;
  nodes: TypeGraphNode[];
  edges: TypeGraphEdge[];
};

export type ProjectInfo = {
  projectRoot: string;
  tsconfigPath: string;
  scopePath?: string;
  nodeCount: number;
  edgeCount: number;
  indexedAt: string;
};

export type GraphSummary = {
  projectRoot: string;
  tsconfigPath: string;
  typeCount: number;
  interfaceCount: number;
  typeAliasCount: number;
  functionTypeAliasCount: number;
  classCount: number;
  enumCount: number;
  primitiveCount: number;
  externalCount: number;
  edgeCount: number;
};
