import { summarizeGraph } from "../../core/indexProject.js";
import { startTypeGraphServer } from "../../server/server.js";
import { indexCliTarget } from "../indexCliTarget.js";
import type { CliOptions } from "../resolveCliOptions.js";

export async function runShowCommand(options: CliOptions): Promise<void> {
  const result = await indexCliTarget(options, (progress) => {
    console.error(progress.message);
  });
  const { graph } = result;
  const summary = summarizeGraph(graph);
  const server = await startTypeGraphServer({
    ...(result.kind === "local" ? { discovery: result.discovery } : {}),
    initialGraph: graph,
    watch: result.kind === "local"
  });

  console.log(
    `TypeGraph indexed ${summary.typeCount} type nodes and ${summary.edgeCount} edges.`
  );
  if (graph.source?.kind === "github") {
    const scope = graph.source.scopePath ?? "root";
    console.log(
      `Source: ${graph.source.owner}/${graph.source.repo} ${graph.source.ref} (${scope})`
    );
  }
  console.log(`Serving explorer at ${server.url}`);
}
