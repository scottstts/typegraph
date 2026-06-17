import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  indexVirtualProject,
  type VirtualProjectFile
} from "../src/core/indexVirtualProject.js";
import type { TypeGraphPayload } from "../src/shared/graphTypes.js";
import { expectEdge, fixturePath, nodeByName } from "./testUtils.js";

async function collectFixtureFiles(
  fixtureName: string,
  virtualRoot = "/repo"
): Promise<VirtualProjectFile[]> {
  const root = fixturePath(fixtureName);
  const files: VirtualProjectFile[] = [];

  async function visit(directory: string): Promise<void> {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath);
        continue;
      }

      const relativePath = path.relative(root, absolutePath).split(path.sep).join("/");
      files.push({
        path: `${virtualRoot}/${relativePath}`,
        text: await fs.readFile(absolutePath, "utf8")
      });
    }
  }

  await visit(root);
  return files;
}

describe("indexVirtualProject", () => {
  test("indexes project-local imports from an in-memory filesystem", async () => {
    const graph = indexVirtualProject({
      files: await collectFixtureFiles("imports"),
      projectRoot: "/repo"
    });

    expectEdge(graph, "Bar", "Foo", "foo", "property");
    expect(nodeByName(graph, "Foo").relativeFilePath).toBe("src/foo.ts");
  });

  test("can index a virtual project without a tsconfig", () => {
    const graph = indexVirtualProject({
      projectRoot: "/repo",
      files: [
        {
          path: "/repo/src/a.ts",
          text: "export interface A { b: B; }\nexport type B = string;\n"
        }
      ]
    });

    expectEdge(graph, "A", "B", "b", "property");
    expect(graph.tsconfigPath).toBe("/repo/tsconfig.typegraph.json");
  });

  test("preserves hosted source metadata", () => {
    const graph: TypeGraphPayload = indexVirtualProject({
      projectRoot: "/github/acme/widgets",
      files: [
        {
          path: "/github/acme/widgets/src/types.ts",
          text: "export type WidgetId = string;\n"
        }
      ],
      source: {
        kind: "github",
        owner: "acme",
        repo: "widgets",
        ref: "main",
        defaultBranch: "main",
        url: "https://github.com/acme/widgets"
      }
    });

    expect(graph.source).toEqual({
      kind: "github",
      owner: "acme",
      repo: "widgets",
      ref: "main",
      defaultBranch: "main",
      url: "https://github.com/acme/widgets"
    });
  });
});
