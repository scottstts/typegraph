import type { Viewport } from "@xyflow/react";

export const VIEWPORT_POSITION_EPSILON = 0.5;
export const VIEWPORT_ZOOM_EPSILON = 0.0001;
export const MOBILE_SELECTION_VISIBILITY_PADDING = 16;

export type CanvasSize = {
  width: number;
  height: number;
};

export type LaneSurfaceMetrics = {
  width: number;
  height: number;
  sourceRailWidth: number;
};

export type ViewportNodeBounds = {
  position: {
    x: number;
    y: number;
  };
  data: {
    width: number;
    height: number;
  };
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function clampViewportToLaneSurface(
  viewport: Viewport,
  canvasSize: CanvasSize,
  layout: LaneSurfaceMetrics,
  minZoom: number,
  maxZoom: number
): Viewport {
  const zoom = Math.min(maxZoom, Math.max(viewport.zoom, minZoom));
  const scaledWidth = layout.width * zoom;
  const scaledHeight = layout.height * zoom;
  const minX = Math.min(layout.sourceRailWidth, canvasSize.width - scaledWidth);
  const maxX = layout.sourceRailWidth;
  const minY = Math.min(0, canvasSize.height - scaledHeight);

  return {
    x: clamp(viewport.x, minX, maxX),
    y: clamp(viewport.y, minY, 0),
    zoom
  };
}

export function viewportNeedsUpdate(current: Viewport, next: Viewport): boolean {
  return (
    Math.abs(current.x - next.x) > VIEWPORT_POSITION_EPSILON ||
    Math.abs(current.y - next.y) > VIEWPORT_POSITION_EPSILON ||
    Math.abs(current.zoom - next.zoom) > VIEWPORT_ZOOM_EPSILON
  );
}

export function nodeIsVisibleInViewport(
  node: ViewportNodeBounds,
  viewport: Viewport,
  canvasSize: CanvasSize,
  padding = MOBILE_SELECTION_VISIBILITY_PADDING
): boolean {
  if (canvasSize.width <= 0 || canvasSize.height <= 0) {
    return false;
  }

  const left = viewport.x + node.position.x * viewport.zoom;
  const right = viewport.x + (node.position.x + node.data.width) * viewport.zoom;
  const top = viewport.y + node.position.y * viewport.zoom;
  const bottom = viewport.y + (node.position.y + node.data.height) * viewport.zoom;

  return (
    right >= padding &&
    left <= canvasSize.width - padding &&
    bottom >= padding &&
    top <= canvasSize.height - padding
  );
}
