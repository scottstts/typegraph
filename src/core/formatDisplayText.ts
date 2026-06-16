import type { Node } from "ts-morph";

export function formatDisplayText(node: Node): string {
  return node.getText().trim();
}

