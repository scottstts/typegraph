import { PRIMITIVE_TYPE_NAMES } from "../shared/constants.js";
import type {
  PrimitiveTypeName,
  TypeGraphNode
} from "../shared/graphTypes.js";

const primitiveNames = new Set<string>(PRIMITIVE_TYPE_NAMES);

export function isPrimitiveTypeName(name: string): name is PrimitiveTypeName {
  return primitiveNames.has(name);
}

export function primitiveNodeId(name: PrimitiveTypeName): string {
  return `primitive:${name}`;
}

export function externalNodeId(name: string): string {
  return `external:${name}`;
}

export function localNodeId(relativeFilePath: string, name: string): string {
  return `local:${relativeFilePath}#${name}`;
}

export function createPrimitiveNode(name: PrimitiveTypeName): TypeGraphNode {
  return {
    id: primitiveNodeId(name),
    name,
    kind: "primitive",
    exported: false,
    displayText: name,
    members: [],
    dependsOn: [],
    dependedOnBy: [],
    isProjectLocal: false,
    isPrimitiveLike: true,
    isExternal: false
  };
}

export function createExternalNode(name: string): TypeGraphNode {
  return {
    id: externalNodeId(name),
    name,
    kind: "external",
    exported: false,
    displayText: name,
    members: [],
    dependsOn: [],
    dependedOnBy: [],
    isProjectLocal: false,
    isPrimitiveLike: false,
    isExternal: true
  };
}

