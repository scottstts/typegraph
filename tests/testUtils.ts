import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  TypeGraphEdge,
  TypeGraphNode,
  TypeGraphPayload
} from "../src/shared/graphTypes.js";
import { indexProject } from "../src/core/indexProject.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));

export function fixturePath(name: string): string {
  return path.join(testDirectory, "fixtures", name);
}

export async function indexFixture(name: string): Promise<TypeGraphPayload> {
  const result = await indexProject({ targetPath: fixturePath(name) });
  return result.graph;
}

export function nodeByName(
  graph: TypeGraphPayload,
  name: string
): TypeGraphNode {
  const node = graph.nodes.find((candidate) => candidate.name === name);
  if (node === undefined) {
    throw new Error(`Expected node ${name} to exist`);
  }
  return node;
}

export function edgesFromName(
  graph: TypeGraphPayload,
  fromName: string
): TypeGraphEdge[] {
  const from = nodeByName(graph, fromName);
  return graph.edges.filter((edge) => edge.from === from.id);
}

export function edgeTargetNames(
  graph: TypeGraphPayload,
  fromName: string
): string[] {
  return edgesFromName(graph, fromName)
    .map((edge) => graph.nodes.find((node) => node.id === edge.to)?.name)
    .filter((name): name is string => name !== undefined)
    .sort();
}

export function expectEdge(
  graph: TypeGraphPayload,
  fromName: string,
  toName: string,
  via?: string,
  kind?: string
): void {
  const from = nodeByName(graph, fromName);
  const to = nodeByName(graph, toName);
  const edge = graph.edges.find(
    (candidate) =>
      candidate.from === from.id &&
      candidate.to === to.id &&
      (via === undefined || candidate.via === via) &&
      (kind === undefined || candidate.kind === kind)
  );
  expect(
    edge,
    `Expected edge ${fromName} -> ${toName}${via === undefined ? "" : ` via ${via}`}`
  ).toBeDefined();
}
