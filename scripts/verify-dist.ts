import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const requiredFiles = [
  "dist/cli.js",
  "dist/server/server.js",
  "dist/web/index.html"
];
const forbiddenPatterns = [
  /HostedRepositoryEntry/,
  /hosted-entry/,
  /indexWorker/,
  /analyze-github/
];

async function collectFiles(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(entryPath)));
    } else {
      files.push(entryPath);
    }
  }

  return files;
}

for (const relativePath of requiredFiles) {
  await fs.access(path.join(root, relativePath));
}

const cliPath = path.join(root, "dist/cli.js");
const cliSource = await fs.readFile(cliPath, "utf8");
const cliStat = await fs.stat(cliPath);

if (!cliSource.startsWith("#!/usr/bin/env node\n")) {
  throw new Error("dist/cli.js is missing its Node.js shebang.");
}

if ((cliStat.mode & 0o111) === 0) {
  throw new Error("dist/cli.js is not executable.");
}

const webFiles = await collectFiles(path.join(root, "dist/web"));
const distFiles = await collectFiles(path.join(root, "dist"));
const sourceMaps = distFiles.filter((filePath) => filePath.endsWith(".map"));

if (sourceMaps.length > 0) {
  throw new Error(
    `Source maps must not be published:\n${sourceMaps
      .map((filePath) => `- ${path.relative(root, filePath)}`)
      .join("\n")}`
  );
}

for (const filePath of webFiles) {
  if (!/\.(css|html|js|map)$/.test(filePath)) {
    continue;
  }

  const contents = await fs.readFile(filePath, "utf8");
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(contents)) {
      throw new Error(
        `Hosted-only code found in ${path.relative(root, filePath)}: ${pattern.source}`
      );
    }
  }
}

console.log("Verified CLI build output and local-only web artifact.");
