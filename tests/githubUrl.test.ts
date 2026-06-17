import { describe, expect, test } from "vitest";
import {
  isExplicitGitHubUrl,
  parseGitHubUrl,
  resolveGitHubRefAndPath
} from "../src/core/githubUrl.js";

describe("GitHub URL parsing", () => {
  test("parses root repository URLs", () => {
    expect(parseGitHubUrl("https://github.com/acme/widgets")).toEqual({
      owner: "acme",
      repo: "widgets",
      route: "root",
      refAndPathSegments: [],
      url: "https://github.com/acme/widgets"
    });
  });

  test("parses shorthand repository URLs", () => {
    expect(parseGitHubUrl("acme/widgets")).toMatchObject({
      owner: "acme",
      repo: "widgets",
      route: "root"
    });
  });

  test("resolves branch and path segments using the longest matching ref", async () => {
    const parsed = parseGitHubUrl(
      "https://github.com/acme/widgets/tree/feature/typegraph/src/app"
    );
    const resolved = await resolveGitHubRefAndPath(
      parsed,
      "main",
      (candidate) => Promise.resolve(candidate === "feature/typegraph")
    );

    expect(resolved).toEqual({
      ref: "feature/typegraph",
      path: "src/app"
    });
  });

  test("uses the default branch for root URLs", async () => {
    const parsed = parseGitHubUrl("https://github.com/acme/widgets");
    const resolved = await resolveGitHubRefAndPath(parsed, "main", () =>
      Promise.resolve(false)
    );

    expect(resolved).toEqual({ ref: "main" });
  });

  test("distinguishes explicit GitHub URLs from local paths", () => {
    expect(isExplicitGitHubUrl("https://github.com/acme/widgets")).toBe(true);
    expect(isExplicitGitHubUrl("github.com/acme/widgets")).toBe(true);
    expect(isExplicitGitHubUrl("playground/mock-codebase")).toBe(false);
    expect(isExplicitGitHubUrl("acme/widgets")).toBe(false);
  });
});
