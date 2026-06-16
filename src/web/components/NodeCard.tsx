import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { CSSProperties } from "react";
import type { TypeGraphNode } from "../../shared/graphTypes.js";
import { kindLabel, usageLabel } from "../graphUi.js";
import { useGraphStore } from "../state/graphStore.js";

export type TypeGraphNodeData = {
  graphNode: TypeGraphNode;
  selected: boolean;
};

export type TypeGraphFlowNode = Node<TypeGraphNodeData, "typeGraphNode">;

export function NodeCard({ data }: NodeProps<TypeGraphFlowNode>) {
  const selectNode = useGraphStore((state) => state.selectNode);
  const node = data.graphNode;
  const connectionCount = node.dependsOn.length + node.dependedOnBy.length;
  const size = Math.min(22, 10 + Math.sqrt(connectionCount) * 2.4);
  const style = { "--node-size": `${size}px` } as CSSProperties;

  return (
    <button
      type="button"
      className={`graph-node ${node.kind} ${data.selected ? "selected" : ""}`}
      style={style}
      aria-label={node.name}
      onClick={(event) => {
        event.stopPropagation();
        selectNode(node.id);
      }}
    >
      <Handle type="target" position={Position.Left} />
      <span className="node-dot" aria-hidden="true" />
      <span className="node-note" role="tooltip">
        <strong>{node.name}</strong>
        <span>{kindLabel(node.kind)}</span>
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
      </span>
      <Handle type="source" position={Position.Right} />
    </button>
  );
}
