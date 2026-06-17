import fs from "node:fs/promises";
import path from "node:path";
import { indexCliTarget } from "../indexCliTarget.js";
import type { CliOptions } from "../resolveCliOptions.js";

export async function runExportCommand(options: CliOptions): Promise<void> {
  const outPath = path.resolve(options.outPath ?? "typegraph.json");
  const { graph } = await indexCliTarget(options, (progress) => {
    console.error(progress.message);
  });

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, `${JSON.stringify(graph, null, 2)}\n`, "utf8");
  console.log(`Wrote TypeGraph JSON to ${outPath}`);
}
