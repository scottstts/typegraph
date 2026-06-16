import fs from "node:fs/promises";
import path from "node:path";
import { isInsidePath, normalizeAbsolutePath } from "./pathUtils.js";

export type ProjectDiscoveryOptions = {
  cwd?: string;
  targetPath?: string;
  projectPath?: string;
};

export type ProjectDiscovery = {
  cwd: string;
  targetPath: string;
  targetIsFile: boolean;
  projectRoot: string;
  tsconfigPath: string;
  scopePath?: string;
};

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function getExistingPathStat(filePath: string): Promise<{
  isFile: boolean;
  isDirectory: boolean;
}> {
  const stat = await fs.stat(filePath);
  return {
    isFile: stat.isFile(),
    isDirectory: stat.isDirectory()
  };
}

async function findNearestTsconfig(startPath: string): Promise<string | undefined> {
  let current = normalizeAbsolutePath(startPath);

  for (;;) {
    const candidate = path.join(current, "tsconfig.json");
    if (await pathExists(candidate)) {
      return candidate;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }

    current = parent;
  }
}

export async function discoverProject(
  options: ProjectDiscoveryOptions = {}
): Promise<ProjectDiscovery> {
  const cwd = normalizeAbsolutePath(options.cwd ?? process.cwd());
  const targetPath = normalizeAbsolutePath(
    options.targetPath === undefined ? cwd : path.resolve(cwd, options.targetPath)
  );

  const targetStat = await getExistingPathStat(targetPath).catch(() => undefined);
  if (targetStat === undefined) {
    throw new Error(`Target path does not exist: ${targetPath}`);
  }

  if (!targetStat.isFile && !targetStat.isDirectory) {
    throw new Error(`Target path is not a file or directory: ${targetPath}`);
  }

  const targetStartDirectory = targetStat.isFile ? path.dirname(targetPath) : targetPath;
  const tsconfigPath =
    options.projectPath === undefined
      ? await findNearestTsconfig(targetStartDirectory)
      : normalizeAbsolutePath(path.resolve(cwd, options.projectPath));

  if (tsconfigPath === undefined) {
    throw new Error(`Could not find tsconfig.json from ${targetStartDirectory}`);
  }

  if (!(await pathExists(tsconfigPath))) {
    throw new Error(`Project tsconfig does not exist: ${tsconfigPath}`);
  }

  const projectRoot = path.dirname(tsconfigPath);
  const scopePath = isInsidePath(projectRoot, targetPath) ? targetPath : undefined;

  return {
    cwd,
    targetPath,
    targetIsFile: targetStat.isFile,
    projectRoot,
    tsconfigPath,
    ...(scopePath === undefined ? {} : { scopePath })
  };
}
