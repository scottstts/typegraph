export function toPosixPath(filePath: string): string {
  return filePath.replaceAll("\\", "/");
}

function trimTrailingSlash(filePath: string): string {
  if (/^[A-Za-z]:\/$/.test(filePath) || filePath === "/") {
    return filePath;
  }

  return filePath.replace(/\/+$/, "");
}

export function normalizePath(filePath: string): string {
  const normalized = toPosixPath(filePath).replace(/\/+/g, "/");
  return trimTrailingSlash(normalized);
}

export function joinPath(...parts: string[]): string {
  const [first, ...rest] = parts;
  if (first === undefined) {
    return ".";
  }

  const joined = [first, ...rest]
    .filter((part) => part !== "")
    .join("/")
    .replace(/\/+/g, "/");

  return normalizePath(joined);
}

export function dirname(filePath: string): string {
  const normalized = normalizePath(filePath);
  const lastSlash = normalized.lastIndexOf("/");

  if (lastSlash <= 0) {
    return normalized.startsWith("/") ? "/" : ".";
  }

  return normalized.slice(0, lastSlash);
}

function pathSegments(filePath: string): string[] {
  return normalizePath(filePath)
    .split("/")
    .filter((segment) => segment !== "");
}

export function relativePath(from: string, to: string): string {
  const normalizedFrom = normalizePath(from);
  const normalizedTo = normalizePath(to);

  if (normalizedFrom === normalizedTo) {
    return "";
  }

  if (normalizedTo.startsWith(`${normalizedFrom}/`)) {
    return normalizedTo.slice(normalizedFrom.length + 1);
  }

  const fromSegments = pathSegments(normalizedFrom);
  const toSegments = pathSegments(normalizedTo);
  let sharedPrefixLength = 0;

  while (
    sharedPrefixLength < fromSegments.length &&
    sharedPrefixLength < toSegments.length &&
    fromSegments[sharedPrefixLength] === toSegments[sharedPrefixLength]
  ) {
    sharedPrefixLength += 1;
  }

  const parentSegments = fromSegments
    .slice(sharedPrefixLength)
    .map(() => "..");
  const childSegments = toSegments.slice(sharedPrefixLength);
  return [...parentSegments, ...childSegments].join("/") || ".";
}

export function isInsidePath(parent: string, child: string): boolean {
  const normalizedParent = normalizePath(parent);
  const normalizedChild = normalizePath(child);
  return (
    normalizedChild === normalizedParent ||
    normalizedChild.startsWith(`${normalizedParent}/`)
  );
}

export function displayPath(projectRoot: string, filePath: string): string {
  const relative = relativePath(projectRoot, filePath);
  return relative === "" ? "." : relative;
}
