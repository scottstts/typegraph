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
  useStoreSelection?: boolean;
  onSelect?: (nodeId: string) => void;
  onHoverStart?: (nodeId: string) => void;
  onHoverEnd?: (nodeId: string) => void;
};

export type TypeGraphFlowNode = FlowNode<TypeGraphNodeData, "typeGraphNode">;

export function NodeCard({ data }: NodeProps<TypeGraphFlowNode>) {
  const node = data.graphNode;
  const storeSelectedNodeId = useGraphStore((state) => state.selectedNodeId);
  const selected = data.useStoreSelection
    ? storeSelectedNodeId === node.id
    : data.selected;
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
        selected ? "selected" : "",
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
        event.preventDefault();
        event.stopPropagation();
        data.onSelect?.(node.id);
      }}
    >
      <Handle type="target" position={Position.Left} />
      <span className="node-dot" aria-hidden="true" />
      <span className="node-label">{node.name}</span>
      <Handle type="source" position={Position.Right} />
    </button>
  );
}
