import path from "node:path";
import { Project, ts } from "ts-morph";

export type LoadedTsMorphProject = {
  project: Project;
  loadedTsconfigPaths: string[];
};

type TsconfigReference = {
  path?: string;
};

type TsconfigJson = {
  references?: TsconfigReference[];
};

function readTsconfig(tsconfigPath: string): TsconfigJson {
  const result = ts.readConfigFile(tsconfigPath, (filePath) =>
    ts.sys.readFile(filePath)
  );
  if (result.error !== undefined) {
    const message = ts.flattenDiagnosticMessageText(result.error.messageText, "\n");
    throw new Error(`Failed to read ${tsconfigPath}: ${message}`);
  }

  return result.config as TsconfigJson;
}

function resolveReferencePath(tsconfigPath: string, referencePath: string): string {
  const resolved = path.resolve(path.dirname(tsconfigPath), referencePath);
  if (resolved.endsWith(".json")) {
    return resolved;
  }

  return path.join(resolved, "tsconfig.json");
}

function collectReferencedTsconfigs(
  tsconfigPath: string,
  seen = new Set<string>()
): string[] {
  const normalized = path.resolve(tsconfigPath);
  if (seen.has(normalized)) {
    return [];
  }

  seen.add(normalized);

  const config = readTsconfig(normalized);
  const references = config.references ?? [];
  const referencedPaths = references
    .map((reference) => reference.path)
    .filter((referencePath): referencePath is string => referencePath !== undefined)
    .map((referencePath) => resolveReferencePath(normalized, referencePath));

  return [
    normalized,
    ...referencedPaths.flatMap((referencedPath) =>
      collectReferencedTsconfigs(referencedPath, seen)
    )
  ];
}

function sourceCount(project: Project): number {
  return project.getSourceFiles().filter((sourceFile) => !sourceFile.isDeclarationFile())
    .length;
}

export function loadTsMorphProject(tsconfigPath: string): LoadedTsMorphProject {
  const tsconfigPaths = collectReferencedTsconfigs(tsconfigPath);
  const rootProject = new Project({
    tsConfigFilePath: tsconfigPath,
    skipAddingFilesFromTsConfig: false
  });

  const primaryTsconfigPath =
    sourceCount(rootProject) === 0 && tsconfigPaths.length > 1
      ? tsconfigPaths[1]
      : tsconfigPaths[0];

  if (primaryTsconfigPath === undefined) {
    throw new Error(`No tsconfig found for ${tsconfigPath}`);
  }

  const project =
    primaryTsconfigPath === tsconfigPath
      ? rootProject
      : new Project({
          tsConfigFilePath: primaryTsconfigPath,
          skipAddingFilesFromTsConfig: false
        });

  for (const referencedTsconfigPath of tsconfigPaths) {
    if (referencedTsconfigPath !== primaryTsconfigPath) {
      project.addSourceFilesFromTsConfig(referencedTsconfigPath);
    }
  }

  return {
    project,
    loadedTsconfigPaths: tsconfigPaths
  };
}
