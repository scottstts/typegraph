import { runExportCommand } from "./commands/export.js";
import { runIndexCommand } from "./commands/index.js";
import { runShowCommand } from "./commands/show.js";
import { parseCliArgs } from "./resolveCliOptions.js";

function printHelp(): void {
  console.log(`TypeGraph

Usage:
  tg show [path | github-url] [--project tsconfig.json]
  tg index [path | github-url] [--project tsconfig.json]
  tg export [path | github-url] --out typegraph.json [--project tsconfig.json]

Commands:
  show     Start the local web explorer
  index    Print a graph summary
  export   Write graph JSON
`);
}

export async function runCli(args: string[]): Promise<void> {
  try {
    const options = parseCliArgs(args);

    if (options.help) {
      printHelp();
      return;
    }

    if (options.command === "show") {
      await runShowCommand(options);
      return;
    }

    if (options.command === "index") {
      await runIndexCommand(options);
      return;
    }

    await runExportCommand(options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`TypeGraph error: ${message}`);
    process.exitCode = 1;
  }
}
