import { Handle, Position, type NodeProps, type Node as FlowNode } from "@xyflow/react";
import type { CSSProperties } from "react";
import type { TypeGraphNode } from "../../shared/graphTypes.js";
import { useGraphStore } from "../state/graphStore.js";

export type TypeGraphNodeData = {
  graphNode: TypeGraphNode;
  dimmed: boolean;
  focused: boolean;
  hovered: boolean;
  selected: boolean;
  sourceColor: string;
  width: number;
  height: number;
  onHoverStart?: (nodeId: string) => void;
  onHoverEnd?: (nodeId: string) => void;
};

export type TypeGraphFlowNode = FlowNode<TypeGraphNodeData, "typeGraphNode">;

export function NodeCard({ data }: NodeProps<TypeGraphFlowNode>) {
  const selectNode = useGraphStore((state) => state.selectNode);
  const node = data.graphNode;
  const connectionCount = node.dependsOn.length + node.dependedOnBy.length;
  const size = Math.min(18, 10 + Math.sqrt(connectionCount) * 1.8);
  const style = {
    "--node-size": `${size}px`,
    "--node-color": data.sourceColor,
    "--node-width": `${data.width}px`,
    "--node-height": `${data.height}px`
  } as CSSProperties;

  function handleHoverStart(): void {
    data.onHoverStart?.(node.id);
  }

  function handleHoverEnd(
    relatedTarget: EventTarget | null,
    currentTarget: HTMLButtonElement
  ): void {
    if (
      relatedTarget instanceof globalThis.Node &&
      currentTarget.contains(relatedTarget)
    ) {
      return;
    }
    data.onHoverEnd?.(node.id);
  }

  return (
    <button
      type="button"
      className={[
        "graph-node",
        "nodrag",
        "nopan",
        node.kind,
        data.selected ? "selected" : "",
        data.focused ? "focused" : "",
        data.hovered ? "hovered" : "",
        data.dimmed ? "dimmed" : ""
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
      aria-label={node.name}
      draggable={false}
      onMouseEnter={handleHoverStart}
      onMouseLeave={(event) => handleHoverEnd(event.relatedTarget, event.currentTarget)}
      onPointerEnter={handleHoverStart}
      onPointerLeave={(event) => handleHoverEnd(event.relatedTarget, event.currentTarget)}
      onPointerCancel={() => data.onHoverEnd?.(node.id)}
      onDragStart={(event) => event.preventDefault()}
      onClick={(event) => {
        event.stopPropagation();
        selectNode(node.id);
      }}
    >
      <Handle type="target" position={Position.Left} />
      <span className="node-dot" aria-hidden="true" />
      <span className="node-label">{node.name}</span>
      <span className="node-hover-card" role="tooltip">
        <strong>{node.name}</strong>
        <span>from {node.relativeFilePath ?? "generated graph"}</span>
        <span>
          depends on <b>{node.dependsOn.length}</b>
        </span>
        {node.dependedOnBy.length === 0 ? (
          <span>
            <b>Root Node</b>
          </span>
        ) : (
          <span>
            used by <b>{node.dependedOnBy.length}</b>
          </span>
        )}
      </span>
      <Handle type="source" position={Position.Right} />
    </button>
  );
}
