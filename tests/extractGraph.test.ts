import { describe, expect, test } from "vitest";
import {
  edgeTargetNames,
  expectEdge,
  indexFixture,
  nodeByName
} from "./testUtils.js";

describe("extractGraph", () => {
  test("extracts primitive object dependencies", async () => {
    const graph = await indexFixture("basic-primitives");

    nodeByName(graph, "TypeA");
    expect(edgeTargetNames(graph, "TypeA")).toEqual([
      "number",
      "string",
      "unknown"
    ]);
  });

  test("extracts function type alias parameter and return dependencies", async () => {
    const graph = await indexFixture("function-types");

    nodeByName(graph, "TypeB");
    expectEdge(graph, "TypeB", "string", "arg1", "functionParam");
    expectEdge(graph, "TypeB", "number", "arg2", "functionParam");
    expectEdge(graph, "TypeB", "TypeA", "return", "functionReturn");
  });

  test("preserves named references in display text for composed objects", async () => {
    const graph = await indexFixture("function-types");
    const typeC = nodeByName(graph, "TypeC");

    expectEdge(graph, "TypeC", "TypeB", "content", "property");
    expect(typeC.displayText).toContain("content: TypeB");
  });

  test("extracts interface extends and property dependencies", async () => {
    const graph = await indexFixture("interfaces-extends");

    expectEdge(graph, "Child", "Parent", "extends", "extends");
    expectEdge(graph, "Child", "Value", "value", "property");
  });

  test("extracts union and intersection dependencies", async () => {
    const graph = await indexFixture("unions-intersections");

    expectEdge(graph, "Result", "Success", "Success", "union");
    expectEdge(graph, "Result", "Failure", "Failure", "union");
    expectEdge(graph, "Combined", "A", "A", "intersection");
    expectEdge(graph, "Combined", "B", "B", "intersection");
  });

  test("resolves imported project-local types", async () => {
    const graph = await indexFixture("imports");

    expectEdge(graph, "Bar", "Foo", "foo", "property");
    expect(nodeByName(graph, "Foo").isProjectLocal).toBe(true);
  });

  test("marks external referenced types as external terminal nodes", async () => {
    const graph = await indexFixture("external-types");
    const abortSignal = nodeByName(graph, "AbortSignal");

    expectEdge(graph, "Request", "AbortSignal", "signal", "property");
    expect(abortSignal.kind).toBe("external");
    expect(abortSignal.isExternal).toBe(true);
  });

  test("loads source files from referenced tsconfigs when the root config is a solution", async () => {
    const graph = await indexFixture("project-references");

    expectEdge(graph, "ReferencedRoot", "ReferencedLeaf", "leaf", "property");
    expectEdge(graph, "ReferencedViewProps", "ReferencedRoot", "root", "property");
    nodeByName(graph, "ToolingConfig");
  });
});
