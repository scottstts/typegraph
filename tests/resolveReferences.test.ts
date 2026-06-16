import { describe, expect, test } from "vitest";
import { expectEdge, indexFixture, nodeByName } from "./testUtils.js";

describe("reference resolution", () => {
  test("keeps imported local aliases project-local", async () => {
    const graph = await indexFixture("imports");

    expectEdge(graph, "Bar", "Foo");
    expect(nodeByName(graph, "Foo").isProjectLocal).toBe(true);
  });

  test("creates external terminal nodes for library types", async () => {
    const graph = await indexFixture("external-types");

    expect(nodeByName(graph, "AbortSignal").isExternal).toBe(true);
  });
});

