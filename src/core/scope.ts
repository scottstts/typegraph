import type { TypeGraphNode, TypeGraphPayload } from "../shared/graphTypes.js";
import { isInsidePath } from "./pathUtils.js";

export function isNodeInScope(node: TypeGraphNode, scopePath?: string): boolean {
  if (scopePath === undefined || !node.isProjectLocal || node.filePath === undefined) {
    return scopePath === undefined;
  }

  return isInsidePath(scopePath, node.filePath);
}

export function withScope(
  payload: TypeGraphPayload,
  scopePath: string | undefined
): TypeGraphPayload {
  if (scopePath === undefined) {
    const next = { ...payload };
    delete next.scopePath;
    return next;
  }

  return {
    ...payload,
    scopePath
  };
}
