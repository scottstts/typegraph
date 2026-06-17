import { InMemoryFileSystemHost, Project } from "ts-morph";
import type { TypeGraphPayload } from "../shared/graphTypes.js";
import { extractGraph } from "./extractGraph.js";
import { dirname, isInsidePath, joinPath, normalizePath } from "./pathUtils.js";

export type VirtualProjectFile = {
  path: string;
  text: string;
};

export type IndexVirtualProjectOptions = {
  files: VirtualProjectFile[];
  projectRoot: string;
  tsconfigPath?: string;
  scopePath?: string;
  source?: TypeGraphPayload["source"];
};

const sourceFilePattern = /\.(cts|mts|tsx?|d\.ts)$/;
const declarationFilePattern = /\.d\.(cts|mts|ts|tsx)$/;

function isTypeScriptSourcePath(filePath: string): boolean {
  return sourceFilePattern.test(filePath) && !declarationFilePattern.test(filePath);
}

function normalizeFiles(files: VirtualProjectFile[]): VirtualProjectFile[] {
  const normalized = new Map<string, VirtualProjectFile>();
  for (const file of files) {
    normalized.set(normalizePath(file.path), {
      path: normalizePath(file.path),
      text: file.text
    });
  }
  return [...normalized.values()].sort((a, b) => a.path.localeCompare(b.path));
}

function writeFiles(
  fileSystem: InMemoryFileSystemHost,
  files: VirtualProjectFile[]
): void {
  for (const file of files) {
    fileSystem.writeFileSync(file.path, file.text);
  }
}

function chooseTsconfigPath(
  files: VirtualProjectFile[],
  projectRoot: string,
  requestedPath: string | undefined
): string {
  if (requestedPath !== undefined) {
    return normalizePath(requestedPath);
  }

  const rootConfig = joinPath(projectRoot, "tsconfig.json");
  if (files.some((file) => file.path === rootConfig)) {
    return rootConfig;
  }

  const nestedConfig = files.find(
    (file) =>
      isInsidePath(projectRoot, file.path) &&
      file.path.endsWith("/tsconfig.json")
  );
  return nestedConfig?.path ?? joinPath(projectRoot, "tsconfig.typegraph.json");
}

function ensureSyntheticTsconfig(
  fileSystem: InMemoryFileSystemHost,
  files: VirtualProjectFile[],
  tsconfigPath: string
): void {
  if (files.some((file) => file.path === tsconfigPath)) {
    return;
  }

  fileSystem.writeFileSync(
    tsconfigPath,
    `${JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "Bundler",
          jsx: "react-jsx",
          strict: true,
          skipLibCheck: true,
          allowSyntheticDefaultImports: true,
          esModuleInterop: true,
          resolveJsonModule: true
        },
        include: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"]
      },
      null,
      2
    )}\n`
  );
}

function addExplicitSourceFiles(
  project: Project,
  files: VirtualProjectFile[],
  projectRoot: string
): void {
  for (const file of files) {
    if (!isInsidePath(projectRoot, file.path) || !isTypeScriptSourcePath(file.path)) {
      continue;
    }

    if (project.getSourceFile(file.path) === undefined) {
      project.addSourceFileAtPath(file.path);
    }
  }
}

export function indexVirtualProject(
  options: IndexVirtualProjectOptions
): TypeGraphPayload {
  const files = normalizeFiles(options.files);
  const projectRoot = normalizePath(options.projectRoot);
  const fileSystem = new InMemoryFileSystemHost();
  writeFiles(fileSystem, files);

  const tsconfigPath = chooseTsconfigPath(files, projectRoot, options.tsconfigPath);
  ensureSyntheticTsconfig(fileSystem, files, tsconfigPath);

  const project = new Project({
    fileSystem,
    tsConfigFilePath: tsconfigPath,
    skipAddingFilesFromTsConfig: false
  });
  addExplicitSourceFiles(project, files, projectRoot);

  return extractGraph({
    project,
    projectRoot,
    tsconfigPath,
    ...(options.scopePath === undefined
      ? {}
      : { scopePath: normalizePath(options.scopePath) }),
    ...(options.source === undefined ? {} : { source: options.source })
  });
}

export function virtualProjectPath(...parts: string[]): string {
  return joinPath("/", ...parts.map((part) => part.replace(/^\/+|\/+$/g, "")));
}

export function virtualProjectDirectory(filePath: string): string {
  return dirname(filePath);
}
