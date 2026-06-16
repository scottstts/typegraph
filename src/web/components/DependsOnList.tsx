import type { TypeGraphNode, TypeGraphPayload } from "../../shared/graphTypes.js";
import { kindLabel } from "../graphUi.js";
import { useGraphStore } from "../state/graphStore.js";

type NodeListProps = {
  graph: TypeGraphPayload;
  node: TypeGraphNode;
};

function LinkedNodeList({
  ids,
  graph
}: {
  ids: string[];
  graph: TypeGraphPayload;
}) {
  const selectNode = useGraphStore((state) => state.selectNode);
  const nodesById = new Map(graph.nodes.map((candidate) => [candidate.id, candidate]));

  if (ids.length === 0) {
    return <p className="empty">None</p>;
  }

  return (
    <div className="linked-list">
      {ids.map((id) => {
        const linkedNode = nodesById.get(id);
        if (linkedNode === undefined) {
          return null;
        }

        return (
          <button key={id} type="button" onClick={() => selectNode(id)}>
            <strong>{linkedNode.name}</strong>
            <span>{kindLabel(linkedNode.kind)}</span>
          </button>
        );
      })}
    </div>
  );
}

export function DependsOnList({ graph, node }: NodeListProps) {
  return <LinkedNodeList ids={node.dependsOn} graph={graph} />;
}

export function DependedOnByList({ graph, node }: NodeListProps) {
  return <LinkedNodeList ids={node.dependedOnBy} graph={graph} />;
}
