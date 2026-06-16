import path from "node:path";

export function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

export function normalizeAbsolutePath(filePath: string): string {
  return path.resolve(filePath);
}

export function relativePath(from: string, to: string): string {
  return toPosixPath(path.relative(from, to));
}

export function isInsidePath(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function displayPath(projectRoot: string, filePath: string): string {
  const relative = relativePath(projectRoot, filePath);
  return relative === "" ? "." : relative;
}

