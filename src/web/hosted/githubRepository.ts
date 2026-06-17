import {
  indexVirtualProject,
  type VirtualProjectFile,
  virtualProjectPath
} from "../../core/indexVirtualProject.js";
import { dirname, joinPath, normalizePath } from "../../core/pathUtils.js";
import type { TypeGraphPayload } from "../../shared/graphTypes.js";
import {
  parseGitHubUrl,
  resolveGitHubRefAndPath,
  type ParsedGitHubUrl
} from "./githubUrl.js";

export type HostedProgress = {
  message: string;
};

type GitHubRepositoryResponse = {
  default_branch: string;
};

type GitHubCommitResponse = {
  sha: string;
  commit: {
    tree: {
      sha: string;
    };
  };
};

type GitHubTreeEntry = {
  path: string;
  mode: string;
  type: "blob" | "tree" | "commit";
  sha: string;
  size?: number;
};

type GitHubTreeResponse = {
  sha: string;
  truncated: boolean;
  tree: GitHubTreeEntry[];
};

type ResolvedCommit = {
  ref: string;
  commitSha: string;
  treeSha: string;
};

type RepoFileEntry = {
  repoPath: string;
  sha: string;
  size?: number;
};

type AnalyzeGitHubRepositoryOptions = {
  input: string;
  onProgress?: (progress: HostedProgress) => void;
};

const apiBase = "https://api.github.com";
const sourceFilePattern = /\.(cts|mts|tsx?)$/;
const declarationFilePattern = /\.d\.(cts|mts|ts|tsx)$/;
const ignoredPathSegments = new Set(["node_modules", "dist", ".tmp"]);

function progress(
  onProgress: ((progress: HostedProgress) => void) | undefined,
  message: string
): void {
  onProgress?.({ message });
}

function apiPath(owner: string, repo: string, suffix: string): string {
  return `${apiBase}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}${suffix}`;
}

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function fetchGitHubJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });

  if (!response.ok) {
    const rateLimitRemaining = response.headers.get("x-ratelimit-remaining");
    const rateLimitReset = response.headers.get("x-ratelimit-reset");
    if (response.status === 403 && rateLimitRemaining === "0") {
      const resetAt =
        rateLimitReset === null
          ? undefined
          : new Date(Number(rateLimitReset) * 1000).toLocaleTimeString();
      throw new Error(
        `GitHub rate limit reached.${resetAt === undefined ? "" : ` Try again after ${resetAt}.`}`
      );
    }

    throw new Error(`GitHub request failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

async function fetchRepository(
  owner: string,
  repo: string
): Promise<GitHubRepositoryResponse> {
  return fetchGitHubJson<GitHubRepositoryResponse>(apiPath(owner, repo, ""));
}

async function tryFetchCommit(
  owner: string,
  repo: string,
  ref: string
): Promise<ResolvedCommit | undefined> {
  const response = await fetch(
    apiPath(owner, repo, `/commits/${encodePath(ref)}`),
    {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      }
    }
  );

  if (response.status === 404 || response.status === 422) {
    return undefined;
  }

  if (!response.ok) {
    throw new Error(`GitHub request failed: ${response.status} ${response.statusText}`);
  }

  const commit = (await response.json()) as GitHubCommitResponse;
  return {
    ref,
    commitSha: commit.sha,
    treeSha: commit.commit.tree.sha
  };
}

async function fetchTree(
  owner: string,
  repo: string,
  treeSha: string,
  recursive: boolean
): Promise<GitHubTreeResponse> {
  const query = recursive ? "?recursive=1" : "";
  return fetchGitHubJson<GitHubTreeResponse>(
    apiPath(owner, repo, `/git/trees/${encodeURIComponent(treeSha)}${query}`)
  );
}

function normalizedRepoPath(path: string | undefined): string | undefined {
  if (path === undefined || path === "" || path === ".") {
    return undefined;
  }

  return normalizePath(path).replace(/^\/+/, "");
}

function ignoredRepoPath(path: string): boolean {
  return path
    .split("/")
    .some((segment) => ignoredPathSegments.has(segment));
}

function isSourceFile(path: string): boolean {
  return sourceFilePattern.test(path) && !declarationFilePattern.test(path);
}

function isConfigFile(path: string): boolean {
  const fileName = path.slice(path.lastIndexOf("/") + 1);
  return (
    (fileName.startsWith("tsconfig") && fileName.endsWith(".json")) ||
    fileName === "package.json"
  );
}

function shouldDownload(path: string): boolean {
  if (ignoredRepoPath(path)) {
    return false;
  }

  return isSourceFile(path) || isConfigFile(path);
}

async function resolveCommitForParsedUrl(
  parsed: ParsedGitHubUrl,
  defaultBranch: string
): Promise<ResolvedCommit & { scopePath?: string }> {
  const commitCache = new Map<string, ResolvedCommit | undefined>();

  async function commitForRef(ref: string): Promise<ResolvedCommit | undefined> {
    if (!commitCache.has(ref)) {
      commitCache.set(ref, await tryFetchCommit(parsed.owner, parsed.repo, ref));
    }

    return commitCache.get(ref);
  }

  if (parsed.route === "root") {
    const commit = await commitForRef(defaultBranch);
    if (commit === undefined) {
      throw new Error(`Could not resolve default branch ${defaultBranch}.`);
    }
    return commit;
  }

  const resolved = await resolveGitHubRefAndPath(
    parsed,
    defaultBranch,
    async (candidate) =>
      (await commitForRef(candidate)) !== undefined
  );
  const commit = await commitForRef(resolved.ref);
  if (commit === undefined) {
    throw new Error(`Could not resolve ${resolved.ref}.`);
  }

  const scopePath = normalizedRepoPath(resolved.path);
  return scopePath === undefined ? commit : { ...commit, scopePath };
}

async function findScopedEntries(
  owner: string,
  repo: string,
  rootTreeSha: string,
  scopePath: string | undefined
): Promise<RepoFileEntry[]> {
  if (scopePath === undefined) {
    const tree = await fetchTree(owner, repo, rootTreeSha, true);
    if (tree.truncated) {
      throw new Error(
        "GitHub returned a truncated repository tree. Use a URL for a smaller subdirectory."
      );
    }

    return tree.tree
      .filter((entry) => entry.type === "blob")
      .map((entry) => ({
        repoPath: entry.path,
        sha: entry.sha,
        ...(entry.size === undefined ? {} : { size: entry.size })
      }));
  }

  const segments = scopePath.split("/").filter(Boolean);
  let treeSha = rootTreeSha;
  let currentPath = "";

  for (const [index, segment] of segments.entries()) {
    const tree = await fetchTree(owner, repo, treeSha, false);
    const entry = tree.tree.find((candidate) => candidate.path === segment);
    currentPath = currentPath === "" ? segment : `${currentPath}/${segment}`;

    if (entry === undefined) {
      throw new Error(`Could not find ${scopePath} in this repository.`);
    }

    if (entry.type === "blob") {
      if (index !== segments.length - 1) {
        throw new Error(`${currentPath} is a file, not a directory.`);
      }

      return [
        {
          repoPath: scopePath,
          sha: entry.sha,
          ...(entry.size === undefined ? {} : { size: entry.size })
        }
      ];
    }

    if (entry.type !== "tree") {
      throw new Error(`${currentPath} is not a source directory.`);
    }

    treeSha = entry.sha;
  }

  const scopedTree = await fetchTree(owner, repo, treeSha, true);
  if (scopedTree.truncated) {
    throw new Error(
      "GitHub returned a truncated repository tree. Use a URL for a smaller subdirectory."
    );
  }

  return scopedTree.tree
    .filter((entry) => entry.type === "blob")
    .map((entry) => ({
      repoPath: `${scopePath}/${entry.path}`,
      sha: entry.sha,
      ...(entry.size === undefined ? {} : { size: entry.size })
    }));
}

async function mapLimit<T, TResult>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<TResult>
): Promise<TResult[]> {
  const results: TResult[] = [];
  let nextIndex = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;
      const item = items[index];
      if (item === undefined) {
        return;
      }
      results[index] = await mapper(item);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );
  return results;
}

async function fetchRawFile(
  owner: string,
  repo: string,
  commitSha: string,
  path: string
): Promise<string> {
  const response = await fetch(
    `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(
      repo
    )}/${encodeURIComponent(commitSha)}/${encodePath(path)}`
  );
  if (!response.ok) {
    throw new Error(`Failed to download ${path}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

function pathWithinScope(repoPath: string, scopePath: string | undefined): string {
  if (scopePath === undefined) {
    return repoPath;
  }

  if (repoPath === scopePath) {
    const directory = dirname(repoPath);
    return directory === "." ? repoPath : repoPath.slice(directory.length + 1);
  }

  return repoPath.slice(scopePath.length + 1);
}

function virtualPathForRepoPath(
  owner: string,
  repo: string,
  scopePath: string | undefined,
  repoPath: string
): string {
  return joinPath(
    virtualProjectPath("github", owner, repo, scopePath ?? ""),
    pathWithinScope(repoPath, scopePath)
  );
}

function virtualRootForScope(
  owner: string,
  repo: string,
  scopePath: string | undefined
): string {
  return virtualProjectPath("github", owner, repo, scopePath ?? "");
}

export async function analyzeGitHubRepository(
  options: AnalyzeGitHubRepositoryOptions
): Promise<TypeGraphPayload> {
  const parsed = parseGitHubUrl(options.input);
  progress(options.onProgress, "Resolving repository");
  const repository = await fetchRepository(parsed.owner, parsed.repo);

  progress(options.onProgress, "Resolving branch");
  const resolved = await resolveCommitForParsedUrl(parsed, repository.default_branch);
  const scopePath = normalizedRepoPath(
    parsed.route === "blob" && resolved.scopePath !== undefined
      ? dirname(resolved.scopePath)
      : resolved.scopePath
  );

  progress(options.onProgress, "Reading repository tree");
  const entries = await findScopedEntries(
    parsed.owner,
    parsed.repo,
    resolved.treeSha,
    parsed.route === "blob" ? resolved.scopePath : scopePath
  );
  const relevantEntries = entries.filter((entry) => shouldDownload(entry.repoPath));
  const sourceEntryCount = relevantEntries.filter((entry) =>
    isSourceFile(entry.repoPath)
  ).length;

  if (sourceEntryCount === 0) {
    throw new Error("No TypeScript source files were found at that repository scope.");
  }

  progress(options.onProgress, `Downloading ${relevantEntries.length} files`);
  const files: VirtualProjectFile[] = await mapLimit(relevantEntries, 8, async (entry) => ({
    path: virtualPathForRepoPath(parsed.owner, parsed.repo, scopePath, entry.repoPath),
    text: await fetchRawFile(
      parsed.owner,
      parsed.repo,
      resolved.commitSha,
      entry.repoPath
    )
  }));

  const projectRoot = virtualRootForScope(parsed.owner, parsed.repo, scopePath);
  progress(options.onProgress, "Indexing TypeScript types");
  return indexVirtualProject({
    files,
    projectRoot,
    source: {
      kind: "github",
      owner: parsed.owner,
      repo: parsed.repo,
      ref: resolved.ref,
      defaultBranch: repository.default_branch,
      ...(scopePath === undefined ? {} : { scopePath }),
      url: parsed.url
    }
  });
}
