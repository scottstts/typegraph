import { indexProject, summarizeGraph } from "../../core/indexProject.js";
import { startTypeGraphServer } from "../../server/server.js";
import {
  toProjectDiscoveryOptions,
  type CliOptions
} from "../resolveCliOptions.js";

export async function runShowCommand(options: CliOptions): Promise<void> {
  const { discovery, graph } = await indexProject(toProjectDiscoveryOptions(options));
  const summary = summarizeGraph(graph);
  const server = await startTypeGraphServer({
    discovery,
    initialGraph: graph,
    watch: true
  });

  console.log(
    `TypeGraph indexed ${summary.typeCount} type nodes and ${summary.edgeCount} edges.`
  );
  console.log(`Serving explorer at ${server.url}`);
}
