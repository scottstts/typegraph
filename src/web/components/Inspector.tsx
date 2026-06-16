import { useMemo } from "react";
import type { TypeGraphNode, TypeGraphPayload } from "../../shared/graphTypes.js";
import { useGraphStore } from "../state/graphStore.js";
import { DependedOnByList, DependsOnList } from "./DependsOnList.js";
import { SourcePreview } from "./SourcePreview.js";

type Token =
  | {
      kind: "text";
      value: string;
    }
  | {
      kind: "reference";
      value: string;
      nodeId: string;
    };

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildReferenceMap(graph: TypeGraphPayload, node: TypeGraphNode): Map<string, string> {
  const nodesById = new Map(graph.nodes.map((candidate) => [candidate.id, candidate]));
  const references = new Map<string, string>();

  for (const id of node.dependsOn) {
    const referencedNode = nodesById.get(id);
    if (referencedNode !== undefined) {
      references.set(referencedNode.name, id);
    }
  }

  return references;
}

function tokenizeDisplayText(text: string, references: Map<string, string>): Token[] {
  if (references.size === 0) {
    return [{ kind: "text", value: text }];
  }

  const names = [...references.keys()].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`\\b(${names.map(escapeRegex).join("|")})\\b`, "g");
  const tokens: Token[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const value = match[0];
    const index = match.index;
    if (index > lastIndex) {
      tokens.push({ kind: "text", value: text.slice(lastIndex, index) });
    }
    tokens.push({
      kind: "reference",
      value,
      nodeId: references.get(value) ?? ""
    });
    lastIndex = index + value.length;
  }

  if (lastIndex < text.length) {
    tokens.push({ kind: "text", value: text.slice(lastIndex) });
  }

  return tokens;
}

function ClickableDisplayText({
  graph,
  node
}: {
  graph: TypeGraphPayload;
  node: TypeGraphNode;
}) {
  const selectNode = useGraphStore((state) => state.selectNode);
  const tokens = useMemo(
    () => tokenizeDisplayText(node.displayText, buildReferenceMap(graph, node)),
    [graph, node]
  );

  return (
    <pre className="display-text">
      {tokens.map((token, index) =>
        token.kind === "text" ? (
          <span key={`${token.value}-${index}`}>{token.value}</span>
        ) : (
          <button
            key={`${token.value}-${index}`}
            type="button"
            onClick={() => selectNode(token.nodeId)}
          >
            {token.value}
          </button>
        )
      )}
    </pre>
  );
}

export function Inspector() {
  const graph = useGraphStore((state) => state.graph);
  const selectedNodeId = useGraphStore((state) => state.selectedNodeId);

  const node = graph?.nodes.find((candidate) => candidate.id === selectedNodeId);

  if (graph === undefined || node === undefined) {
    return (
      <aside className="panel inspector">
        <p className="empty">No node selected</p>
      </aside>
    );
  }

  return (
    <aside className="panel inspector">
      <header className="inspector-header">
        <div>
          <span>{node.kind === "typeAlias" ? "type alias" : node.kind}</span>
          <h2>{node.name}</h2>
        </div>
        <small>{node.exported ? "exported" : "local"}</small>
      </header>

      {node.relativeFilePath !== undefined && (
        <p className="source-line">
          {node.relativeFilePath}
          {node.startLine === undefined ? "" : `:${node.startLine}`}
        </p>
      )}

      <section>
        <h3>Declaration</h3>
        <ClickableDisplayText graph={graph} node={node} />
      </section>

      <section>
        <h3>Members</h3>
        {node.members.length === 0 ? (
          <p className="empty">None</p>
        ) : (
          <div className="member-list">
            {node.members.map((member, index) => (
              <div key={`${member.kind}-${member.name}-${index}`} className="member">
                <strong>
                  {member.name}
                  {member.optional ? "?" : ""}
                </strong>
                <span>{member.displayType}</span>
                <small>{member.kind}</small>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3>Depends On</h3>
        <DependsOnList graph={graph} node={node} />
      </section>

      <section>
        <h3>Used By</h3>
        <DependedOnByList graph={graph} node={node} />
      </section>

      <section>
        <h3>Source</h3>
        <SourcePreview nodeId={node.id} fallback={node.sourceText ?? node.displayText} />
      </section>
    </aside>
  );
}

