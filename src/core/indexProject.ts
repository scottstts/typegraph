import type {
  GraphSummary,
  TypeGraphPayload
} from "../shared/graphTypes.js";
import {
  discoverProject,
  type ProjectDiscovery,
  type ProjectDiscoveryOptions
} from "./discoverProject.js";
import { extractGraph } from "./extractGraph.js";
import { loadTsMorphProject } from "./loadTsMorphProject.js";

export type IndexProjectResult = {
  discovery: ProjectDiscovery;
  graph: TypeGraphPayload;
};

export function indexDiscoveredProject(
  discovery: ProjectDiscovery
): TypeGraphPayload {
  const { project } = loadTsMorphProject(discovery.tsconfigPath);

  return extractGraph({
    project,
    projectRoot: discovery.projectRoot,
    tsconfigPath: discovery.tsconfigPath,
    ...(discovery.scopePath === undefined ? {} : { scopePath: discovery.scopePath })
  });
}

export async function indexProject(
  options: ProjectDiscoveryOptions = {}
): Promise<IndexProjectResult> {
  const discovery = await discoverProject(options);
  const graph = indexDiscoveredProject(discovery);
  return { discovery, graph };
}

export function summarizeGraph(graph: TypeGraphPayload): GraphSummary {
  const functionTypeAliasCount = graph.nodes.filter(
    (node) =>
      node.kind === "typeAlias" &&
      (node.members.some((member) => member.kind === "functionParam") ||
        node.members.some((member) => member.kind === "functionReturn"))
  ).length;

  return {
    projectRoot: graph.projectRoot,
    tsconfigPath: graph.tsconfigPath,
    typeCount: graph.nodes.filter((node) => node.isProjectLocal).length,
    interfaceCount: graph.nodes.filter((node) => node.kind === "interface").length,
    typeAliasCount: graph.nodes.filter((node) => node.kind === "typeAlias").length,
    functionTypeAliasCount,
    classCount: graph.nodes.filter((node) => node.kind === "class").length,
    enumCount: graph.nodes.filter((node) => node.kind === "enum").length,
    primitiveCount: graph.nodes.filter((node) => node.kind === "primitive").length,
    externalCount: graph.nodes.filter((node) => node.kind === "external").length,
    edgeCount: graph.edges.length
  };
}
