# Server

The server lives in `src/server` and provides the local API used by the web GUI. It is started by the `show` CLI command after the project has been indexed once.

## Runtime Shape

`startTypeGraphServer` in `src/server/server.ts` creates a Fastify app, registers API routes, optionally serves the built GUI, optionally starts file watching, and returns:

- `app`, the Fastify instance.
- `url`, the GUI URL to open.
- `apiUrl`, the Fastify API base URL.
- `close`, which closes the watcher, Vite dev server, and Fastify instance.

The API host is `127.0.0.1`. The preferred API port is `4321`; `listenWithFallback` tries the next 19 ports when a port is already in use.

## Development Vs Built Serving

The server detects built runtime by checking whether `import.meta.url` is under `dist`.

In development, `show` starts:

- Fastify for `/api`.
- a Vite dev server for the React GUI.
- a Vite proxy for `/api`, including WebSocket support.

The dev GUI preferred port is `5174`, with Vite allowed to choose another port.

In built runtime, Fastify serves the static GUI from `dist/web` through `@fastify/static`. Non-API misses fall back to `index.html`, so the GUI can handle client-side routes if they are added later. `/api/*` misses return JSON 404 responses.

## Mutable Graph State

The server keeps one in-memory graph in `createGraphState`.

State exposes:

- `getGraph`
- `setGraph`
- `subscribe`

`setGraph` replaces the whole graph and notifies subscribers with a `GraphUpdatedEvent` containing `type`, `indexedAt`, `nodeCount`, and `edgeCount`.

Subscribers are used by the SSE endpoint. The current event type is `graph-updated`, sent under the SSE event name `graph-update`.

## API Routes

Routes are registered in `src/server/api.ts`.

`GET /api/project`

Returns project metadata: project root, tsconfig path, optional scope path, node count, edge count, and indexed timestamp.

`GET /api/graph`

Returns the full current `TypeGraphPayload`.

`GET /api/node/:id`

Returns `{ node }` for a graph node id, or 404 when the node id is unknown.

`GET /api/search?q=...`

Returns `{ results }` from `searchNodes`. Search is server-side and currently only searches project-local nodes.

`GET /api/neighborhood?nodeId=...&depth=...&direction=...`

Returns a depth-limited dependency/dependent subgraph. `depth` defaults to `1`, is clamped to `0...5`, and invalid values become `1`. `direction` may be `dependencies`, `dependents`, or `both`; invalid values become `both`.

`POST /api/scope`

Accepts `{ scopePath?: string }`, applies `withScope`, stores the returned graph with `setGraph`, and returns `{ graph }`.

Current behavior only changes the graph's `scopePath` metadata. It does not filter nodes or edges and does not re-index the project.

`GET /api/source?nodeId=...`

Returns `{ nodeId, sourceText }` using `node.sourceText` with `node.displayText` as fallback. Missing `nodeId` returns 400; unknown nodes return 404.

`GET /api/events`

Opens a server-sent events stream. On graph changes it writes:

```text
event: graph-update
data: {"type":"graph-updated",...}
```

The connection is hijacked from Fastify and unsubscribes on request close.

## Watch Mode

`startProjectWatcher` in `src/server/watch.ts` uses chokidar on `discovery.projectRoot`.

Ignored paths include:

- `node_modules`
- `dist`
- `.git`
- `.tmp`

Only `.ts` files are handled, and `.d.ts` files are ignored. `add`, `change`, and `unlink` events schedule a full project re-index after a debounce, defaulting to 500 ms.

On successful re-index, `onGraph` replaces server state and emits SSE updates. On failure, `onError` logs through Fastify.

The watcher currently re-indexes the entire discovered project; it does not perform incremental graph updates.

## CLI Integration

`tg show` runs `indexProject`, computes a summary for console output, then starts the server with `watch: true`.

`tg index` and `tg export` use the same engine path without starting the server. `export` writes the full `TypeGraphPayload` as formatted JSON.

CLI argument parsing supports:

- default command `show`
- commands `show`, `index`, and `export`
- one optional target path
- `--project <tsconfig.json>`
- `--out <file>` for export
