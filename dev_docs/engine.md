# Engine

The engine lives in `src/core` and turns a TypeScript project into a serializable `TypeGraphPayload`. It is responsible for project discovery, ts-morph project loading, declaration extraction, reference resolution, graph summaries, and in-memory graph queries.

## Data Model

Shared graph types are defined in `src/shared/graphTypes.ts`.

`TypeGraphPayload` is the top-level value used by the CLI, server, and GUI. It contains:

- `projectRoot`, the directory containing the selected `tsconfig.json`.
- `tsconfigPath`, the config used for indexing.
- optional `scopePath`, currently metadata describing the selected scope.
- `indexedAt`, an ISO timestamp from extraction time.
- `nodes`, the extracted type nodes.
- `edges`, the directed dependency edges.

`TypeGraphNode` represents a local declaration, primitive terminal, or external terminal. Local nodes include file location, authored source text, authored display text, members, dependency ids, dependent ids, and classification flags. Primitive and external nodes are terminal nodes with no source location.

Node id formats are intentionally stable:

- `local:<relative-file>#<symbol>` for project-local declarations.
- `primitive:<name>` for primitive-like terminal nodes.
- `external:<name>` for referenced symbols that are not resolved to project-local declarations or primitives.

If two local declarations would produce the same local id in one file, the later id is suffixed with `@<startLine>`.

`TypeGraphEdge` stores `from`, `to`, `via`, and `kind`. `via` is a compact authored location such as a property name, parameter name, `return`, `extends`, `implements`, or the referenced union/intersection type text. `kind` distinguishes relationships such as `property`, `method`, `functionParam`, `functionReturn`, `extends`, `implements`, `union`, `intersection`, `genericArg`, `arrayElement`, and `tupleElement`.

## Project Discovery

`discoverProject` in `src/core/discoverProject.ts` normalizes `cwd`, `targetPath`, and optional `projectPath`.

If no `projectPath` is supplied, discovery walks upward from the target directory until it finds `tsconfig.json`. For file targets, the walk starts from the file's parent directory. The project root is the directory containing the resolved tsconfig.

`scopePath` is set when the requested target is inside the project root. This currently records the selected view scope but does not filter extraction.

## Loading TypeScript Projects

`loadTsMorphProject` in `src/core/loadTsMorphProject.ts` creates a ts-morph `Project` from the discovered tsconfig.

It also follows TypeScript project references recursively. This matters for solution-style root configs with `"files": []`: if the root project contains no non-declaration source files and has references, the first referenced config becomes the primary ts-morph project, and the rest of the referenced configs are added with `addSourceFilesFromTsConfig`.

## Extraction Flow

`extractGraph` in `src/core/extractGraph.ts` performs extraction in two passes.

First, it selects project source files. It ignores declaration files and excludes paths outside the project root, `node_modules`, `dist`, and `.tmp`.

Second, it registers all local declarations before resolving references. Registered local declarations include:

- type aliases
- interfaces
- named classes
- enums

Each declaration creates a local node with authored declaration text from `declaration.getText()`. The extractor intentionally preserves authored declaration text for `displayText` instead of replacing it with compiler-expanded type text.

After registration, the extractor walks each declaration and adds members and dependency edges. It updates both `dependsOn` and `dependedOnBy` arrays from the edge set before returning the payload.

## Reference Resolution

Reference resolution is symbol-first. `registerSymbol` stores both the declaration symbol and its export symbol. `resolveSymbolId` checks the symbol, export symbol, aliased symbol, and aliased export symbol.

When a reference cannot be resolved to a local symbol, extraction falls back to the reference display name:

- primitive names become primitive terminal nodes.
- all other names become external terminal nodes.

The extractor recognizes primitive keyword types and literal types such as string literals, numeric literals, boolean literals, and `null`.

For type syntax, references are collected through:

- `TypeReference` and `ExpressionWithTypeArguments`
- generic type arguments
- arrays and tuples
- unions and intersections
- type operators and parenthesized types
- function type parameters and return types
- indexed access types
- type literals and their properties, methods, call signatures, and index signatures
- child traversal fallback for other syntax

Self-edges are suppressed except for union and intersection edges.

## Members

Members are stored on the owning node and include name, optional/readonly flags, authored display type, referenced type ids, and member kind.

Supported member forms include properties, methods, function type parameters/returns, call signatures, construct signatures, index signatures, union members, intersection members, and tuple elements. Member extraction is used by the inspector and by summaries such as function type alias counting.

## Queries And Summaries

`src/core/graphQueries.ts` provides in-memory graph operations:

- `getNode` and `requireNode`
- `searchNodes`, limited to project-local nodes and ranked by exact, prefix, and substring matches against name and file path
- `getDependencies`
- `getDependents`
- `getNeighborhood`, with depth-limited traversal over dependencies, dependents, or both
- `getEdgesBetween`
- `graphSummary`

`summarizeGraph` in `src/core/indexProject.ts` counts local types, interfaces, type aliases, function type aliases, classes, enums, primitive nodes, external nodes, and edges.

## Scope Semantics

`src/core/scope.ts` currently only applies or clears `payload.scopePath`. It does not filter `nodes` or `edges`. The helper `isNodeInScope` exists but is not used by the current server or GUI filtering path.

Any future scope implementation should be explicit about whether scope is metadata, a filtered graph view, or a re-indexed project subset.

## Test Coverage

Current engine tests cover primitive dependencies, function type alias dependencies, authored display text preservation, interface extends, union/intersection edges, imported local references, external terminal nodes, project-reference loading, graph queries, and project discovery scope metadata.
