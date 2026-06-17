import { summarizeGraph } from "../../core/indexProject.js";
import { indexCliTarget } from "../indexCliTarget.js";
import type { CliOptions } from "../resolveCliOptions.js";

export async function runIndexCommand(options: CliOptions): Promise<void> {
  const { graph } = await indexCliTarget(options, (progress) => {
    console.error(progress.message);
  });
  const summary = summarizeGraph(graph);

  console.log(`Project: ${summary.projectRoot}`);
  console.log(`tsconfig: ${summary.tsconfigPath}`);
  if (graph.source?.kind === "github") {
    const scope = graph.source.scopePath ?? "root";
    console.log(
      `Source: ${graph.source.owner}/${graph.source.repo} ${graph.source.ref} (${scope})`
    );
  }
  console.log(`Types: ${summary.typeCount}`);
  console.log(`Interfaces: ${summary.interfaceCount}`);
  console.log(`Type aliases: ${summary.typeAliasCount}`);
  console.log(`Function type aliases: ${summary.functionTypeAliasCount}`);
  console.log(`Classes: ${summary.classCount}`);
  console.log(`Enums: ${summary.enumCount}`);
  console.log(`Edges: ${summary.edgeCount}`);
  console.log(`External references: ${summary.externalCount}`);
}
