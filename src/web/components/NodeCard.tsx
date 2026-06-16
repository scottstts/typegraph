import type { NodeProps, Node } from "@xyflow/react";
import type { TypeGraphNode } from "../../shared/graphTypes.js";
import { useGraphStore } from "../state/graphStore.js";

export type TypeGraphNodeData = {
  graphNode: TypeGraphNode;
  selected: boolean;
};

export type TypeGraphFlowNode = Node<TypeGraphNodeData, "typeGraphNode">;

export function NodeCard({ data }: NodeProps<TypeGraphFlowNode>) {
  const selectNode = useGraphStore((state) => state.selectNode);
  const node = data.graphNode;

  return (
    <button
      type="button"
      className={`graph-node ${node.kind} ${data.selected ? "selected" : ""}`}
      onClick={() => selectNode(node.id)}
    >
      <strong>{node.name}</strong>
      <span>{node.kind === "typeAlias" ? "type alias" : node.kind}</span>
      <small>
        {node.members.length} members · depends on {node.dependsOn.length} · used by{" "}
        {node.dependedOnBy.length}
      </small>
    </button>
  );
}

