import { BaseEdge, type Edge, type EdgeProps } from "@xyflow/react";

export type CanvasEdgeData = {
  color: string;
  dimmed: boolean;
  focused: boolean;
};

export type TypeGraphFlowEdge = Edge<CanvasEdgeData, "canvasEdge">;

export function CanvasEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  selected
}: EdgeProps<TypeGraphFlowEdge>) {
  const distance = Math.abs(targetX - sourceX);
  const curve = Math.max(120, Math.min(360, distance * 0.48));
  const path = [
    `M ${sourceX} ${sourceY}`,
    `C ${sourceX + curve} ${sourceY}`,
    `${targetX - curve} ${targetY}`,
    `${targetX} ${targetY}`
  ].join(" ");
  const focused = selected === true || data?.focused === true;
  const dimmed = data?.dimmed === true;

  return (
    <BaseEdge
      id={id}
      path={path}
      interactionWidth={18}
      className={`canvas-edge${focused ? " focused" : ""}${dimmed ? " dimmed" : ""}`}
      style={{
        stroke: data?.color ?? "#4c5751",
        strokeLinecap: "round",
        strokeWidth: focused ? 2.5 : 1.55,
        opacity: dimmed ? 0.14 : focused ? 0.94 : 0.52
      }}
    />
  );
}
