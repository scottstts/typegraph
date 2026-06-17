import type { TypeGraphNode } from "../../shared/graphTypes.js";
import { kindLabel } from "../graphUi.js";
import { useGraphStore } from "../state/graphStore.js";

type NodeListProps = {
  nodesById: ReadonlyMap<string, TypeGraphNode>;
  node: TypeGraphNode;
};

function LinkedNodeList({
  ids,
  nodesById
}: {
  ids: string[];
  nodesById: ReadonlyMap<string, TypeGraphNode>;
}) {
  const selectNode = useGraphStore((state) => state.selectNode);

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

export function DependsOnList({ nodesById, node }: NodeListProps) {
  return <LinkedNodeList ids={node.dependsOn} nodesById={nodesById} />;
}

export function DependedOnByList({ nodesById, node }: NodeListProps) {
  return <LinkedNodeList ids={node.dependedOnBy} nodesById={nodesById} />;
}
