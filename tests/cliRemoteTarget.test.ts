import { describe, expect, test } from "vitest";
import { indexCliTarget } from "../src/cli/indexCliTarget.js";
import { parseCliArgs } from "../src/cli/resolveCliOptions.js";

describe("CLI remote targets", () => {
  test("accepts explicit GitHub URLs as command targets", () => {
    expect(
      parseCliArgs([
        "export",
        "https://github.com/acme/widgets/tree/main/src",
        "--out",
        "graph.json"
      ])
    ).toEqual({
      command: "export",
      targetPath: "https://github.com/acme/widgets/tree/main/src",
      outPath: "graph.json",
      help: false
    });
  });

  test("keeps owner/repo-looking values as local paths in CLI mode", () => {
    expect(parseCliArgs(["show", "playground/mock-codebase"])).toEqual({
      command: "show",
      targetPath: "playground/mock-codebase",
      help: false
    });
  });

  test("rejects --project for GitHub targets before fetching", async () => {
    await expect(
      indexCliTarget({
        command: "show",
        targetPath: "https://github.com/acme/widgets",
        projectPath: "tsconfig.json",
        help: false
      })
    ).rejects.toThrow("--project is only supported for local filesystem targets.");
  });
});
