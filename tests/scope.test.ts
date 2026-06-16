import path from "node:path";
import { describe, expect, test } from "vitest";
import { discoverProject } from "../src/core/discoverProject.js";
import { fixturePath } from "./testUtils.js";

describe("project discovery", () => {
  test("discovers the nearest tsconfig and stores the selected view scope", async () => {
    const fixture = fixturePath("imports");
    const target = path.join(fixture, "src");

    const discovery = await discoverProject({ targetPath: target });

    expect(discovery.projectRoot).toBe(fixture);
    expect(discovery.tsconfigPath).toBe(path.join(fixture, "tsconfig.json"));
    expect(discovery.scopePath).toBe(target);
  });

  test("uses a file target's directory to find the project", async () => {
    const fixture = fixturePath("imports");
    const target = path.join(fixture, "src", "bar.ts");

    const discovery = await discoverProject({ targetPath: target });

    expect(discovery.projectRoot).toBe(fixture);
    expect(discovery.targetIsFile).toBe(true);
    expect(discovery.scopePath).toBe(target);
  });
});

