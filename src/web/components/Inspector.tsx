import { useMemo } from "react";
import type { ReactNode } from "react";
import type { TypeGraphNode } from "../../shared/graphTypes.js";
import { kindLabel, usageLabel } from "../graphUi.js";
import { useGraphStore } from "../state/graphStore.js";
import { DependedOnByList, DependsOnList } from "./DependsOnList.js";

type Token =
  | {
      kind: "text";
      value: string;
    }
  | {
      kind: "syntax";
      value: string;
      syntaxKind: "keyword" | "string" | "number" | "comment" | "punctuation";
    }
  | {
      kind: "reference";
      value: string;
      nodeId: string;
    };

const syntaxKeywords = new Set([
  "abstract",
  "as",
  "class",
  "const",
  "declare",
  "enum",
  "export",
  "extends",
  "false",
  "from",
  "implements",
  "import",
  "interface",
  "keyof",
  "namespace",
  "new",
  "null",
  "readonly",
  "true",
  "type",
  "undefined"
]);

const syntaxPattern =
  /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|`(?:\\[\s\S]|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b[A-Za-z_$][\w$]*\b|\b\d+(?:\.\d+)?\b|[{}()[\]<>=:;|&?,.])/g;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildReferenceMap(
  nodesById: ReadonlyMap<string, TypeGraphNode>,
  node: TypeGraphNode
): Map<string, string> {
  const references = new Map<string, string>();

  for (const id of node.dependsOn) {
    const referencedNode = nodesById.get(id);
    if (referencedNode !== undefined) {
      references.set(referencedNode.name, id);
    }
  }

  return references;
}

function syntaxKind(value: string): Extract<Token, { kind: "syntax" }>["syntaxKind"] {
  if (value.startsWith("//") || value.startsWith("/*")) {
    return "comment";
  }

  if (value.startsWith("'") || value.startsWith('"') || value.startsWith("`")) {
    return "string";
  }

  if (/^\d/.test(value)) {
    return "number";
  }

  if (syntaxKeywords.has(value)) {
    return "keyword";
  }

  return "punctuation";
}

function tokenizeSyntaxText(text: string): Token[] {
  const tokens: Token[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(syntaxPattern)) {
    const value = match[0];
    const index = match.index;
    if (index > lastIndex) {
      tokens.push({ kind: "text", value: text.slice(lastIndex, index) });
    }

    if (syntaxKeywords.has(value) || !/^[A-Za-z_$][\w$]*$/.test(value)) {
      tokens.push({ kind: "syntax", value, syntaxKind: syntaxKind(value) });
    } else {
      tokens.push({ kind: "text", value });
    }

    lastIndex = index + value.length;
  }

  if (lastIndex < text.length) {
    tokens.push({ kind: "text", value: text.slice(lastIndex) });
  }

  return tokens;
}

function tokenizeDisplayText(text: string, references: Map<string, string>): Token[] {
  if (references.size === 0) {
    return tokenizeSyntaxText(text);
  }

  const names = [...references.keys()].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`\\b(${names.map(escapeRegex).join("|")})\\b`, "g");
  const tokens: Token[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const value = match[0];
    const index = match.index;
    if (index > lastIndex) {
      tokens.push(...tokenizeSyntaxText(text.slice(lastIndex, index)));
    }
    tokens.push({
      kind: "reference",
      value,
      nodeId: references.get(value) ?? ""
    });
    lastIndex = index + value.length;
  }

  if (lastIndex < text.length) {
    tokens.push(...tokenizeSyntaxText(text.slice(lastIndex)));
  }

  return tokens;
}

function ClickableDisplayText({
  nodesById,
  node
}: {
  nodesById: ReadonlyMap<string, TypeGraphNode>;
  node: TypeGraphNode;
}) {
  const selectNode = useGraphStore((state) => state.selectNode);
  const tokens = useMemo(
    () => tokenizeDisplayText(node.displayText, buildReferenceMap(nodesById, node)),
    [node, nodesById]
  );

  return (
    <pre className="display-text">
      {tokens.map((token, index) =>
        token.kind === "text" ? (
          <span key={`${token.value}-${index}`}>{token.value}</span>
        ) : token.kind === "syntax" ? (
          <span
            key={`${token.value}-${index}`}
            className={`syntax-token ${token.syntaxKind}`}
          >
            {token.value}
          </span>
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

function RelationshipSection({
  title,
  count,
  children
}: {
  title: string;
  count?: number | undefined;
  children: ReactNode;
}) {
  return (
    <details className="inspector-section" open>
      <summary>
        <span>
          {title}
          {count !== undefined && <> <b>{count}</b></>}
        </span>
      </summary>
      <div className="inspector-section-body">{children}</div>
    </details>
  );
}

export function Inspector() {
  const graph = useGraphStore((state) => state.graph);
  const selectedNodeId = useGraphStore((state) => state.selectedNodeId);
  const nodesById = useMemo(
    () =>
      graph === undefined
        ? undefined
        : new Map(graph.nodes.map((candidate) => [candidate.id, candidate])),
    [graph]
  );

  const node =
    selectedNodeId === undefined ? undefined : nodesById?.get(selectedNodeId);

  if (graph === undefined || nodesById === undefined || node === undefined) {
    return (
      <aside className="panel inspector">
        <p className="empty inspector-empty">Select a node to inspect details.</p>
      </aside>
    );
  }

  return (
    <aside className="panel inspector">
      <header className="inspector-header">
        <div className="inspector-title">
          <div className="inspector-badges">
            <span>{kindLabel(node.kind)}</span>
            {node.exported && <span>exported</span>}
          </div>
          <h2>{node.name}</h2>
        </div>
      </header>

      {node.relativeFilePath !== undefined && (
        <p className="source-line">
          {node.relativeFilePath}
          {node.startLine === undefined ? "" : `:${node.startLine}`}
        </p>
      )}

      <section>
        <h3>Declaration</h3>
        <ClickableDisplayText nodesById={nodesById} node={node} />
      </section>

      <RelationshipSection title="Depends On" count={node.dependsOn.length}>
        <DependsOnList nodesById={nodesById} node={node} />
      </RelationshipSection>

      <RelationshipSection
        title={node.dependedOnBy.length === 0 ? usageLabel(node) : "Used By"}
        count={node.dependedOnBy.length === 0 ? undefined : node.dependedOnBy.length}
      >
        {node.dependedOnBy.length === 0 ? (
          <p className="empty">No incoming type references.</p>
        ) : (
          <DependedOnByList nodesById={nodesById} node={node} />
        )}
      </RelationshipSection>
    </aside>
  );
}
