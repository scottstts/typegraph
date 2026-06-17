import { describe, expect, test } from "vitest";
import {
  clampViewportToLaneSurface,
  nodeIsVisibleInViewport,
  viewportNeedsUpdate
} from "../src/web/graphViewport.js";

describe("graph viewport helpers", () => {
  test("clamps viewport position and zoom to the lane surface", () => {
    expect(
      clampViewportToLaneSurface(
        { x: -2_000, y: -2_000, zoom: 0.01 },
        { width: 400, height: 300 },
        { width: 1_000, height: 800, sourceRailWidth: 120 },
        0.5,
        1.5
      )
    ).toEqual({ x: -100, y: -100, zoom: 0.5 });

    expect(
      clampViewportToLaneSurface(
        { x: 300, y: 50, zoom: 2 },
        { width: 400, height: 300 },
        { width: 1_000, height: 800, sourceRailWidth: 120 },
        0.2,
        1.5
      )
    ).toEqual({ x: 120, y: 0, zoom: 1.5 });
  });

  test("detects meaningful viewport updates", () => {
    expect(
      viewportNeedsUpdate(
        { x: 10, y: 20, zoom: 0.7 },
        { x: 10.25, y: 20.25, zoom: 0.70005 }
      )
    ).toBe(false);

    expect(
      viewportNeedsUpdate(
        { x: 10, y: 20, zoom: 0.7 },
        { x: 10.75, y: 20, zoom: 0.7 }
      )
    ).toBe(true);

    expect(
      viewportNeedsUpdate(
        { x: 10, y: 20, zoom: 0.7 },
        { x: 10, y: 20, zoom: 0.7002 }
      )
    ).toBe(true);
  });

  test("keeps compact selection from recentering already visible nodes", () => {
    const node = {
      position: { x: 200, y: 120 },
      data: { width: 90, height: 42 }
    };
    const canvasSize = { width: 390, height: 500 };

    expect(
      nodeIsVisibleInViewport(node, { x: -80, y: 0, zoom: 1 }, canvasSize)
    ).toBe(true);

    expect(
      nodeIsVisibleInViewport(node, { x: -320, y: 0, zoom: 1 }, canvasSize)
    ).toBe(false);

    expect(
      nodeIsVisibleInViewport(node, { x: 0, y: -220, zoom: 1 }, canvasSize)
    ).toBe(false);
  });
});
