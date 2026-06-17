import { analyzeGitHubRepository } from "../core/githubRepository.js";
import { isExplicitGitHubUrl } from "../core/githubUrl.js";
import {
  indexProject,
  type IndexProjectResult
} from "../core/indexProject.js";
import type { TypeGraphPayload } from "../shared/graphTypes.js";
import {
  toProjectDiscoveryOptions,
  type CliOptions
} from "./resolveCliOptions.js";

export type CliIndexResult =
  | (IndexProjectResult & {
      kind: "local";
    })
  | {
      kind: "github";
      graph: TypeGraphPayload;
    };

export type CliIndexProgress = {
  message: string;
};

export async function indexCliTarget(
  options: CliOptions,
  onProgress?: (progress: CliIndexProgress) => void
): Promise<CliIndexResult> {
  if (!isExplicitGitHubUrl(options.targetPath)) {
    return {
      kind: "local",
      ...(await indexProject(toProjectDiscoveryOptions(options)))
    };
  }

  if (options.projectPath !== undefined) {
    throw new Error("--project is only supported for local filesystem targets.");
  }

  const targetPath = options.targetPath;
  if (targetPath === undefined) {
    throw new Error("Missing GitHub repository URL.");
  }

  const graph = await analyzeGitHubRepository({
    input: targetPath,
    ...(onProgress === undefined ? {} : { onProgress })
  });

  return {
    kind: "github",
    graph
  };
}
