import { indexProject, summarizeGraph } from "../../core/indexProject.js";
import {
  toProjectDiscoveryOptions,
  type CliOptions
} from "../resolveCliOptions.js";

export async function runIndexCommand(options: CliOptions): Promise<void> {
  const { graph } = await indexProject(toProjectDiscoveryOptions(options));
  const summary = summarizeGraph(graph);

  console.log(`Project: ${summary.projectRoot}`);
  console.log(`tsconfig: ${summary.tsconfigPath}`);
  console.log(`Types: ${summary.typeCount}`);
  console.log(`Interfaces: ${summary.interfaceCount}`);
  console.log(`Type aliases: ${summary.typeAliasCount}`);
  console.log(`Function type aliases: ${summary.functionTypeAliasCount}`);
  console.log(`Classes: ${summary.classCount}`);
  console.log(`Enums: ${summary.enumCount}`);
  console.log(`Edges: ${summary.edgeCount}`);
  console.log(`External references: ${summary.externalCount}`);
}
