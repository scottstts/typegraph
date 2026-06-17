export type ParsedGitHubUrl = {
  owner: string;
  repo: string;
  route: "root" | "tree" | "blob";
  refAndPathSegments: string[];
  url: string;
};

export type RefResolution = {
  ref: string;
  path?: string;
};

function decodePathSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function inputToUrl(input: string): URL {
  const trimmed = input.trim();
  if (trimmed === "") {
    throw new Error("Enter a GitHub repository URL.");
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return new URL(trimmed);
  }

  if (/^(www\.)?github\.com\//i.test(trimmed)) {
    return new URL(`https://${trimmed}`);
  }

  if (/^[^/\s]+\/[^/\s]+(?:\/.*)?$/.test(trimmed)) {
    return new URL(`https://github.com/${trimmed}`);
  }

  throw new Error("Enter a GitHub repository URL.");
}

export function isExplicitGitHubUrl(input: string | undefined): boolean {
  if (input === undefined) {
    return false;
  }

  const trimmed = input.trim();
  return /^(https?:\/\/)?(www\.)?github\.com\//i.test(trimmed);
}

export function parseGitHubUrl(input: string): ParsedGitHubUrl {
  const url = inputToUrl(input);
  const hostname = url.hostname.toLowerCase();
  if (hostname !== "github.com" && hostname !== "www.github.com") {
    throw new Error("Only github.com repository URLs are supported.");
  }

  const segments = url.pathname
    .split("/")
    .filter(Boolean)
    .map(decodePathSegment);
  const [owner, rawRepo, routeSegment, ...rest] = segments;

  if (owner === undefined || rawRepo === undefined) {
    throw new Error("GitHub URL must include an owner and repository name.");
  }

  const repo = rawRepo.replace(/\.git$/i, "");
  if (repo === "") {
    throw new Error("GitHub URL must include a repository name.");
  }

  if (routeSegment === undefined) {
    return {
      owner,
      repo,
      route: "root",
      refAndPathSegments: [],
      url: `https://github.com/${owner}/${repo}`
    };
  }

  if (routeSegment !== "tree" && routeSegment !== "blob") {
    return {
      owner,
      repo,
      route: "root",
      refAndPathSegments: [],
      url: `https://github.com/${owner}/${repo}`
    };
  }

  if (rest.length === 0) {
    throw new Error(`GitHub ${routeSegment} URL must include a branch or tag.`);
  }

  return {
    owner,
    repo,
    route: routeSegment,
    refAndPathSegments: rest,
    url: `https://github.com/${owner}/${repo}/${routeSegment}/${rest
      .map(encodeURIComponent)
      .join("/")}`
  };
}

export async function resolveGitHubRefAndPath(
  parsed: ParsedGitHubUrl,
  defaultBranch: string,
  refExists: (candidate: string) => Promise<boolean>
): Promise<RefResolution> {
  if (parsed.route === "root") {
    return { ref: defaultBranch };
  }

  for (let length = parsed.refAndPathSegments.length; length >= 1; length -= 1) {
    const ref = parsed.refAndPathSegments.slice(0, length).join("/");
    if (await refExists(ref)) {
      const path = parsed.refAndPathSegments.slice(length).join("/");
      return path === "" ? { ref } : { ref, path };
    }
  }

  throw new Error(
    `Could not resolve a branch or tag from ${parsed.owner}/${parsed.repo}.`
  );
}
