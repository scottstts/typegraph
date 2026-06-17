# GUI

The GUI lives in `src/web` and is a Vite React application. It consumes the local Fastify API, stores the current graph in Zustand, and renders a whole-project dependency canvas with side panels for search/filtering and inspection.

## Application Shell

`src/web/App.tsx` chooses runtime mode by browser hostname. Localhost, `127.0.0.1`, and `::1` keep the local API-backed behavior. Non-local origins show the hosted GitHub repository intake first, then render the same three-column shell after browser-side indexing completes.

The three-column shell contains:

- left search/filter panel
- central graph canvas
- right inspector panel

The left and right panels are resizable within fixed min/max widths and can be collapsed from buttons inside the canvas. In local mode, the app loads the graph on mount and opens an `EventSource` to `/api/events`; every `graph-update` event triggers a full graph reload. Hosted mode does not call local API endpoints.

## Store

`src/web/state/graphStore.ts` defines the Zustand store.

State includes:

- current `graph`
- `selectedNodeId`
- search query
- visibility toggles for primitive and external nodes
- exported-only toggle
- test exclusion toggle
- orphan exclusion toggle
- local kind filters for type aliases, interfaces, classes, and enums
- dependency/dependent depth values, currently stored but not used by the canvas
- loading, error, and updated timestamp

Defaults are:

- primitives hidden
- external nodes hidden
- exported-only disabled
- tests excluded
- local orphan declarations excluded
- all local declaration kinds enabled

`loadGraph` fetches `/api/graph`. `applyScope` posts to `/api/scope` for local graphs. For hosted GitHub graphs, `applyScope` only updates payload metadata client-side to avoid calling the absent local backend. Both preserve the current selection only if the selected node still exists in the returned graph.

Hosted analysis is run from `src/web/hosted/indexWorker.ts`, which calls the shared GitHub loader in `src/core/githubRepository.ts`. The worker fetches public GitHub repository data, builds a virtual ts-morph project, indexes it, and returns the same `TypeGraphPayload` used by local mode.

## API Client

`src/web/api/client.ts` wraps `fetch` for:

- `fetchProject`
- `fetchGraph`
- `updateScope`
- `fetchSource`

Only `fetchGraph` and `updateScope` are used by the current main UI. `fetchSource` is used by `SourcePreview`, which is present but not currently rendered by the inspector.

## Filtering

Filtering helpers live in `src/web/graphUi.ts`.

`nodeMatchesFilters` applies:

- primitive visibility
- external visibility
- exported-only
- test/spec/regression path exclusion
- orphan exclusion
- local declaration kind filters
- search query against node name and relative file path

When the search query is empty, local nodes are visible by default, while primitive and external nodes require their toggles.

An orphan is a project-local declared node with no incoming references and no dependencies on other project-local declared nodes. Dependencies only on primitive or external nodes still count as orphan behavior.

The canvas and search panel both use the same filter function. The canvas additionally keeps the selected node visible even when filters would normally hide it, so a search or inspector selection can still center on a canvas node.

## Search Panel

`src/web/components/SearchPanel.tsx` renders:

- project name
- text search
- `ScopeSelector`
- filter toggles
- declaration kind toggles
- up to 120 matching results

Each result shows the node name, kind, file location, dependency count, and usage count/root-node label. Selecting a result updates `selectedNodeId`.

For hosted GitHub graphs, the brand block below `TypeGraph` shows `owner/repo` and a compact `branch · scope` line. Local graphs continue to show the local project directory name.

`ScopeSelector` builds options from project-local node file directories. Selecting a directory posts its absolute directory path to `/api/scope`. Current server behavior records scope metadata only; the GUI does not receive a filtered graph from scope changes.

## Canvas

`src/web/components/GraphCanvas.tsx` renders the graph using React Flow.

The canvas is a whole-filtered-graph view, not a selected-node neighborhood view. Nodes are not draggable or connectable. Clicking a node selects it; clicking blank canvas clears selection.

The canvas tracks:

- filtered visible graph
- base layout
- decorated selected/hover state
- React Flow viewport
- measured canvas size
- hovered node id

Viewport behavior is bounded to the source-lane surface. Minimum zoom is computed as a live cover-fit of the layout against the visible canvas, bounded by hard zoom limits. Resize corrections clamp x/y immediately so side-panel collapse does not leave blank space around the lane surface.

When a selected node exists in the layout, the canvas centers it and uses at least the selected-node zoom.

## Layout

`src/web/graphLayout.ts` builds the React Flow layout.

Layout uses ELK's layered algorithm with rightward dependency direction and spline routing. ELK computes relative dependency ordering, then TypeGraph projects nodes into horizontal source-file lanes.

If ELK fails on a very large or pathological visible graph, `buildCanvasLayout` falls back to a deterministic lane layout instead of rejecting. The fallback preserves source lanes, node rendering, filtering, selection, and edge rendering, but dependency ordering is less refined.

Important layout concepts:

- lanes are grouped by `relativeFilePath`
- primitive nodes use `types/primitives`
- external nodes use `types/external`
- each lane has a color/fill pair and fixed minimum height
- a fixed source rail overlays the left side and follows vertical pan/zoom
- node x position is based on ELK x position, scaled and offset after the rail
- node y position is lane-local row order
- node widths are measured from dot size plus label text

`decorateCanvasLayout` applies selected/hover focus. The active node is the hovered node when present, otherwise the selected node. Connected nodes and edges remain emphasized while unrelated nodes and edges are dimmed.

## Node And Edge Rendering

`NodeCard` renders each type as a compact button with:

- a left target handle
- a source-colored dot
- the type name
- a right source handle

Dot size grows with total connection count. Node labels intentionally remain type names only; details belong in hover cards and the inspector.

`CanvasEdge` renders curved cubic Bezier edges. Edge color comes from the source node's lane. Focused edges are thicker and more opaque; dimmed edges are faint.

Hover cards are rendered as screen-space overlays in `GraphCanvas`, not inside React Flow's zoomed node DOM. Their position is computed from the node position and current viewport transform.

## Inspector

`src/web/components/Inspector.tsx` is empty until a node is selected.

For a selected node, it shows:

- kind and exported badges
- name
- relative source path and start line when available
- authored declaration text
- dependencies
- dependents or root-node status

The declaration display uses a lightweight tokenizer for syntax highlighting. References in the selected node's `dependsOn` list are converted into clickable tokens by matching referenced node names in the authored declaration text.

Relationship lists are rendered by `DependsOnList` and `DependedOnByList`; each linked node button selects that node.
