import { describe, expect, test } from "vitest";
import {
  getDependencies,
  getNeighborhood,
  searchNodes
} from "../src/core/graphQueries.js";
import { indexFixture, nodeByName } from "./testUtils.js";

describe("graph queries", () => {
  test("searches project-local nodes by name", async () => {
    const graph = await indexFixture("imports");

    expect(searchNodes(graph, "bar").map((node) => node.name)).toEqual(["Bar"]);
  });

  test("returns dependencies for a selected node", async () => {
    const graph = await indexFixture("imports");
    const bar = nodeByName(graph, "Bar");

    expect(getDependencies(graph, bar.id).map((node) => node.name)).toEqual(["Foo"]);
  });

  test("builds dependency neighborhoods", async () => {
    const graph = await indexFixture("function-types");
    const typeB = nodeByName(graph, "TypeB");
    const neighborhood = getNeighborhood(graph, typeB.id, 1, "dependencies");

    expect(neighborhood.nodes.map((node) => node.name).sort()).toEqual([
      "TypeA",
      "TypeB",
      "number",
      "string"
    ]);
  });
});

