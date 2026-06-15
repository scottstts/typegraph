# TypeGraph Full Implementation Plan

## 1. Core purpose

Build **TypeGraph**, a local developer tool for exploring the TypeScript type structure of a codebase.

The tool should parse a TypeScript project, discover type aliases, interfaces, function type aliases, classes/enums where relevant, and build a navigable type dependency graph.

The intended user experience is:

* Every TypeScript type/interface/type alias is represented as a graph node.
* When inspecting one node, show its own one-level declared shape, similar to an IDE hover tooltip.
* Referenced types inside that shape should be clickable.
* The graph should show both:

  * what the selected type depends on
  * what depends on the selected type
* Do not recursively unwrap every referenced type inside the inspector.
* Preserve named type references.
* Let the graph and clickable references provide navigation.
* The graph can trace dependencies down to primitive or external terminal nodes.
* The UI should support downstream and upstream navigation.
* The tool should be CLI-first, with a local web GUI for graph exploration.

Example:

```ts
type TypeA = {
  id: number;
  name: string;
  content: unknown;
};

type TypeB = (arg1: string, arg2: number) => TypeA;

type TypeC = {
  id: string;
  count: number;
  content: TypeB;
};
```

The graph should understand:

```txt
TypeC -> TypeB
TypeB -> TypeA
TypeA -> number
TypeA -> string
TypeA -> unknown
```

But when inspecting `TypeC`, the inspector should show only:

```ts
type TypeC = {
  id: string;
  count: number;
  content: TypeB;
};
```

`TypeB` should be clickable. Clicking it recenters the graph and shows `TypeB` independently.

This is not a normal documentation generator. It is a focused type graph explorer for understanding a TypeScript codebase’s data model.

---

## 2. Product shape

TypeGraph should be a **single npm-based TypeScript project**.

It is not a normal React app and not a pure terminal app.

The product identity is:

```txt
a local TypeScript type graph explorer CLI
```

The React GUI is the visual interface served by the CLI.

The project contains:

* Node CLI entrypoint
* TypeScript type graph extraction engine
* local HTTP server/API
* React/Vite web GUI
* shared graph/API payload types
* test fixture projects
* removable mock TypeScript codebase for manual integration testing

The final installed tool should expose:

```bash
tg show
tg show ./some/path
tg index
tg export --out typegraph.json
```

The CLI should:

1. Resolve the target project.
2. Find the relevant `tsconfig.json`.
3. Index the TypeScript project.
4. Build a type graph.
5. Start a local server for `tg show`.
6. Serve the local web GUI.
7. Expose graph data to the GUI through local API endpoints.

---

## 3. Long-term technical direction

Use the long-term setup from the beginning.

Do not start with CommonJS and migrate later.

Use:

```txt
npm
TypeScript strict mode
ESM
tsc for Node CLI/backend compilation
Vite for React GUI build and development serving
React for GUI
React Flow for graph canvas
ts-morph for TypeScript analysis
Fastify for local server
Vitest for tests
ESLint for linting
```

Node code should be compiled with `tsc`, not bundled with `tsup` or another bundler unless that choice is explicitly revisited.

Keep a thin root CLI entrypoint at `src/cli.ts` so `tsc` emits `dist/cli.js` for npm bin usage. The implementation modules should compile alongside it under `dist/cli`, `dist/server`, `dist/core`, and `dist/shared`.

Expected final build output:

```txt
dist/
├─ cli.js
├─ cli/
├─ server/
├─ core/
├─ shared/
└─ web/
   ├─ index.html
   └─ assets/
      ├─ index-[hash].js
      └─ index-[hash].css
```

`dist/cli.js` is the actual CLI entrypoint used by:

```bash
tg
typegraph
```

When the user runs:

```bash
tg show ./src
```

the CLI starts a local server, serves `dist/web`, and provides graph data through local API routes.

During source development, commands run through `tsx src/cli.ts`. In that mode `tg show` should not require `dist/web` to exist. It should start the local API server and serve or proxy the React GUI through Vite dev serving, then print the GUI URL. Built commands run through `node dist/cli.js` and serve `dist/web`.

---

## 4. Repository structure

Use this structure:

```txt
typegraph/
├─ package.json
├─ package-lock.json
│
├─ tsconfig.base.json
├─ tsconfig.node.json
├─ tsconfig.web.json
├─ tsconfig.test.json
│
├─ vite.config.ts
├─ vitest.config.ts
├─ index.html
│
├─ src/
│  ├─ cli.ts
│  │
│  ├─ cli/
│  │  ├─ cli.ts
│  │  ├─ commands/
│  │  │  ├─ show.ts
│  │  │  ├─ index.ts
│  │  │  └─ export.ts
│  │  └─ resolveCliOptions.ts
│  │
│  ├─ server/
│  │  ├─ server.ts
│  │  ├─ api.ts
│  │  ├─ static.ts
│  │  └─ watch.ts
│  │
│  ├─ core/
│  │  ├─ indexProject.ts
│  │  ├─ discoverProject.ts
│  │  ├─ extractGraph.ts
│  │  ├─ resolveReferences.ts
│  │  ├─ formatDisplayText.ts
│  │  ├─ scope.ts
│  │  ├─ graphQueries.ts
│  │  └─ primitives.ts
│  │
│  ├─ shared/
│  │  ├─ graphTypes.ts
│  │  ├─ apiTypes.ts
│  │  └─ constants.ts
│  │
│  └─ web/
│     ├─ main.tsx
│     ├─ App.tsx
│     ├─ api/
│     │  └─ client.ts
│     ├─ state/
│     │  └─ graphStore.ts
│     ├─ components/
│     │  ├─ SearchPanel.tsx
│     │  ├─ ScopeSelector.tsx
│     │  ├─ GraphCanvas.tsx
│     │  ├─ NodeCard.tsx
│     │  ├─ Inspector.tsx
│     │  ├─ DependsOnList.tsx
│     │  ├─ DependedOnByList.tsx
│     │  └─ SourcePreview.tsx
│     └─ styles/
│        └─ app.css
│
├─ tests/
│  ├─ fixtures/
│  │  ├─ basic-primitives/
│  │  │  ├─ tsconfig.json
│  │  │  └─ src/
│  │  │     └─ types.ts
│  │  │
│  │  ├─ imports/
│  │  │  ├─ tsconfig.json
│  │  │  └─ src/
│  │  │     ├─ foo.ts
│  │  │     └─ bar.ts
│  │  │
│  │  ├─ function-types/
│  │  │  ├─ tsconfig.json
│  │  │  └─ src/
│  │  │     └─ types.ts
│  │  │
│  │  ├─ interfaces-extends/
│  │  │  ├─ tsconfig.json
│  │  │  └─ src/
│  │  │     └─ types.ts
│  │  │
│  │  ├─ unions-intersections/
│  │  │  ├─ tsconfig.json
│  │  │  └─ src/
│  │  │     └─ types.ts
│  │  │
│  │  └─ external-types/
│  │     ├─ tsconfig.json
│  │     └─ src/
│  │        └─ types.ts
│  │
│  ├─ extractGraph.test.ts
│  ├─ resolveReferences.test.ts
│  ├─ scope.test.ts
│  └─ graphQueries.test.ts
│
├─ playground/
│  └─ mock-codebase/
│     ├─ package.json
│     ├─ tsconfig.json
│     └─ src/
│        ├─ index.ts
│        ├─ domain/
│        │  ├─ primitives.ts
│        │  ├─ users.ts
│        │  └─ addresses.ts
│        ├─ catalog/
│        │  ├─ products.ts
│        │  └─ inventory.ts
│        ├─ orders/
│        │  ├─ cart.ts
│        │  └─ checkout.ts
│        └─ app/
│           ├─ state.ts
│           └─ commands.ts
│
├─ .tmp/
│  └─ mock-typegraph.json
│
└─ dist/
   ├─ cli.js
   ├─ cli/
   ├─ server/
   ├─ core/
   ├─ shared/
   └─ web/
      ├─ index.html
      └─ assets/
         ├─ index-[hash].js
         └─ index-[hash].css
```

---

## 5. Directory responsibilities

### `src/cli` and `src/cli.ts`

Owns the command-line interface.

Responsibilities:

* parse commands
* resolve CLI options
* resolve target path
* call project discovery
* call graph extraction
* start local server for `tg show`
* write JSON for `tg export`
* print summaries for `tg index`

Main commands:

```bash
tg show
tg show ./src/orders
tg index
tg export --out typegraph.json
```

Suggested files:

```txt
src/cli.ts
src/cli/cli.ts
src/cli/commands/show.ts
src/cli/commands/index.ts
src/cli/commands/export.ts
src/cli/resolveCliOptions.ts
```

`src/cli.ts` is the thin bin entrypoint that compiles to `dist/cli.js`. Most CLI implementation should live under `src/cli/`.

---

### `src/server`

Owns the local HTTP server used by `tg show`.

Responsibilities:

* serve the GUI from Vite during source development
* serve the built GUI from `dist/web` after `npm run build`
* expose graph API endpoints
* expose selected node/source endpoints
* manage watch mode
* notify GUI when graph updates

Suggested API endpoints:

```txt
GET /api/project
GET /api/graph
GET /api/node/:id
GET /api/search?q=CheckoutInput
GET /api/neighborhood?nodeId=...&depth=1&direction=both
POST /api/scope
```

Suggested files:

```txt
src/server/server.ts
src/server/api.ts
src/server/static.ts
src/server/watch.ts
```

---

### `src/core`

Owns TypeScript project analysis and graph construction.

Responsibilities:

* find project root and `tsconfig.json`
* load the TypeScript project with `ts-morph`
* collect type aliases, interfaces, classes, enums, and function type aliases
* extract one-level display shape
* resolve project-local references
* identify primitive and external terminal nodes
* build dependency and reverse-dependency edges
* apply view scope filtering
* provide graph query helpers for the server/UI

Important: `src/core` should be Node-only. The React web app should not import `src/core`.

Suggested files:

```txt
src/core/discoverProject.ts
src/core/indexProject.ts
src/core/extractGraph.ts
src/core/resolveReferences.ts
src/core/formatDisplayText.ts
src/core/scope.ts
src/core/graphQueries.ts
src/core/primitives.ts
```

---

### `src/shared`

Owns types/constants shared between Node and browser.

Responsibilities:

* graph payload types
* API response types
* shared enum/string constants
* stable node/edge/member model definitions

Examples:

```ts
TypeGraphNode
TypeGraphEdge
TypeGraphMember
TypeGraphPayload
ProjectInfo
GraphScope
```

This directory can be imported by:

```txt
src/core
src/server
src/web
```

Keep it free of Node APIs and browser APIs.

---

### `src/web`

Owns the React/Vite GUI.

Responsibilities:

* search panel
* scope selector
* focused graph canvas
* selected node inspector
* clickable type references
* depends-on and depended-on-by navigation
* source preview
* graph filters

The GUI should not perform TypeScript analysis. It only consumes graph data from the local server API.

Suggested files:

```txt
src/web/main.tsx
src/web/App.tsx
src/web/api/client.ts
src/web/state/graphStore.ts
src/web/components/SearchPanel.tsx
src/web/components/ScopeSelector.tsx
src/web/components/GraphCanvas.tsx
src/web/components/NodeCard.tsx
src/web/components/Inspector.tsx
src/web/components/DependsOnList.tsx
src/web/components/DependedOnByList.tsx
src/web/components/SourcePreview.tsx
src/web/styles/app.css
```

---

### `tests/fixtures`

Small permanent fixture projects for unit/regression tests.

These are not for manual GUI testing. They exist to assert exact graph extraction behavior.

Fixture categories:

```txt
basic-primitives
imports
function-types
interfaces-extends
unions-intersections
external-types
```

These should stay in the repo permanently.

---

### `playground/mock-codebase`

A realistic but small standalone TypeScript project used for manual testing.

This is the dogfood target project.

It should:

* have its own `package.json`
* have its own `tsconfig.json`
* not import TypeGraph source code
* be excluded from the TypeGraph root build
* be removable without breaking TypeGraph
* be used only as an external target path passed into the CLI

Manual workflows:

```bash
npm run dev:mock
npm run dev:mock:orders
npm run export:mock
tg show playground/mock-codebase
```

---

## 6. npm scripts

Use npm only.

Recommended scripts:

```json
{
  "scripts": {
    "dev": "tsx src/cli.ts",
    "dev:mock": "tsx src/cli.ts show playground/mock-codebase",
    "dev:mock:orders": "tsx src/cli.ts show playground/mock-codebase/src/orders",
    "export:mock": "tsx src/cli.ts export playground/mock-codebase --out .tmp/mock-typegraph.json",

    "typecheck": "npm run typecheck:node && npm run typecheck:web && npm run typecheck:test",
    "typecheck:node": "tsc -p tsconfig.node.json --noEmit",
    "typecheck:web": "tsc -p tsconfig.web.json --noEmit",
    "typecheck:test": "tsc -p tsconfig.test.json --noEmit",

    "lint": "eslint . --max-warnings=0",
    "test": "vitest",
    "clean": "rimraf dist .tmp",
    "build": "npm run clean && npm run lint && npm run typecheck && npm run build:web && npm run build:node",
    "build:web": "vite build",
    "build:node": "tsc -p tsconfig.node.json",
    "start": "node dist/cli.js"
  },
  "bin": {
    "tg": "./dist/cli.js",
    "typegraph": "./dist/cli.js"
  }
}
```

Expected workflows:

### Install

```bash
npm install
```

### Run mock codebase during development

```bash
npm run dev:mock
```

### Run scoped mock graph

```bash
npm run dev:mock:orders
```

### Run arbitrary project

```bash
npm run dev -- show ~/code/some-ts-project
```

### Export graph JSON

```bash
npm run export:mock
```

### Run tests

```bash
npm test
```

### Typecheck

```bash
npm run typecheck
```

### Lint

```bash
npm run lint
```

### Build

```bash
npm run build
```

### Test built CLI

```bash
npm run build
npm run start -- show playground/mock-codebase
```

### Test globally linked CLI

```bash
npm run build
npm link
tg show playground/mock-codebase
```

Unlink later:

```bash
npm unlink -g typegraph
```

`vite.config.ts` should set the production output directory to `dist/web`. Make sure Vite does not delete compiled Node output if the build order is changed later.

---

## 7. CLI behavior

### `tg show`

Default command for normal use.

```bash
tg show
```

Behavior:

1. Resolve project root.
2. Find nearest `tsconfig.json`.
3. Index all project-local TypeScript source files covered by tsconfig.
4. Exclude `node_modules`, build output, declaration files, and external libs by default.
5. Start local server.
6. Serve GUI.
7. Print URL.

Example output:

```txt
TypeGraph indexed 438 type nodes and 912 edges.
Serving explorer at http://localhost:4321
```

---

### `tg show <path>`

```bash
tg show ./src/orders
```

This should still index the full project so cross-file type resolution works, but initialize the GUI with the selected directory scope.

Important distinction:

```txt
Index scope = full project
View scope = selected path
```

The selected path should be a GUI filter/scope, not a limitation that breaks type resolution.

---

### `tg index`

```bash
tg index
```

Indexes and prints summary without launching GUI.

Example:

```txt
Project: /path/to/project
tsconfig: /path/to/project/tsconfig.json
Types: 438
Interfaces: 127
Type aliases: 211
Function type aliases: 34
Edges: 912
External references: 89
```

---

### `tg export`

```bash
tg export --out typegraph.json
```

Writes graph data to JSON.

Useful for debugging, snapshots, and regression checks.

---

## 8. Project discovery

Implement robust project discovery.

Behavior:

1. If user passes a path, resolve it.
2. If the path is a file, treat its directory as the starting point.
3. Walk upward from that path to find `tsconfig.json`.
4. If no `tsconfig.json` is found, show a clear error.
5. If a selected path is inside a project, index the project root but set the selected path as initial view scope.

Add optional explicit project support:

```bash
tg show --project ./tsconfig.app.json
```

This does not need to be a prominent v1 feature, but the structure should not prevent it.

---

## 9. Core extraction model

Use `ts-morph` to load the TypeScript project from `tsconfig.json`.

Collect project-local declarations:

* type aliases
* interfaces
* function type aliases
* enums
* classes, shallowly
* exported and non-exported types
* imported type references that resolve to project-local declarations

Do not include every function implementation. This tool is about type declarations and type relationships.

Function type aliases and callable interface signatures should be represented.

Exclude by default:

* `node_modules`
* generated build output
* `dist`
* external library declarations
* TypeScript lib declarations
* `.d.ts` files unless project-local support is intentionally added

External references such as `AbortSignal`, `Promise`, `HTMLElement`, `ReactNode`, etc. should appear as external terminal nodes only when referenced by project-local nodes.

---

## 10. Graph model

Use a graph internally, not a strict tree.

Reason: TypeScript types are reused by many parents, so a strict tree would duplicate shared types incorrectly.

The GUI can render focused tree-like neighborhoods, but the internal data model should be graph/DAG-like.

### Node model

Use this conceptual model:

```ts
type TypeGraphNode = {
  id: string;
  name: string;
  kind:
    | "typeAlias"
    | "interface"
    | "class"
    | "enum"
    | "primitive"
    | "external";

  filePath?: string;
  startLine?: number;
  startColumn?: number;
  endLine?: number;
  endColumn?: number;

  exported: boolean;
  sourceText?: string;

  displayText: string;
  members: TypeGraphMember[];

  dependsOn: string[];
  dependedOnBy: string[];

  scopePath?: string;
  isProjectLocal: boolean;
  isPrimitiveLike: boolean;
  isExternal: boolean;
};
```

### Member model

Use this conceptual model:

```ts
type TypeGraphMember = {
  name: string;
  optional: boolean;
  readonly: boolean;
  displayType: string;
  referencedTypeIds: string[];
  kind:
    | "property"
    | "method"
    | "callSignature"
    | "constructSignature"
    | "indexSignature"
    | "unionMember"
    | "intersectionMember"
    | "tupleElement"
    | "functionParam"
    | "functionReturn";
};
```

### Edge model

Use this conceptual model:

```ts
type TypeGraphEdge = {
  id: string;
  from: string;
  to: string;
  via: string;
  kind:
    | "property"
    | "functionParam"
    | "functionReturn"
    | "extends"
    | "implements"
    | "union"
    | "intersection"
    | "genericArg"
    | "arrayElement"
    | "tupleElement";
};
```

Example edges:

```txt
CheckoutInput -> CartSnapshot via cart
CheckoutInput -> UserProfile via customer
CheckoutInput -> RequestContext via context
TypeB -> string via arg1
TypeB -> number via arg2
TypeB -> TypeA via return
```

---

## 11. Type reference extraction rules

### Type aliases

Handle object type aliases:

```ts
type Foo = {
  bar: Bar;
};
```

Extract member:

```txt
Foo.bar -> Bar
```

Handle function type aliases:

```ts
type Handler = (input: Input) => Output;
```

Extract:

```txt
Handler.input -> Input
Handler.return -> Output
```

Handle unions:

```ts
type Result = Success | Failure;
```

Extract:

```txt
Result -> Success
Result -> Failure
```

Handle intersections:

```ts
type CheckoutInput = CartSnapshot & {
  customer: UserProfile;
};
```

Extract:

```txt
CheckoutInput -> CartSnapshot
CheckoutInput.customer -> UserProfile
```

---

### Interfaces

Handle properties:

```ts
interface Foo {
  bar: Bar;
}
```

Extract:

```txt
Foo.bar -> Bar
```

Handle extends:

```ts
interface Child extends Parent {
  value: Value;
}
```

Extract:

```txt
Child -> Parent kind extends
Child.value -> Value
```

Handle call signatures where practical:

```ts
interface Handler {
  (input: Input): Output;
}
```

Extract:

```txt
Handler.input -> Input
Handler.return -> Output
```

---

### Classes

In this project, classes are secondary.

Include class as a node and extract:

* extended class
* implemented interfaces
* declared properties if straightforward
* constructor parameter properties if straightforward

Do not analyze method bodies.

---

### Enums

Enum nodes usually have no dependencies.

Include them as nodes so references to them can be clickable.

---

### Primitives

Primitive terminal nodes:

```txt
string
number
boolean
bigint
symbol
null
undefined
unknown
any
never
void
object
```

Include them in graph data, but hide them by default in the GUI.

---

### External types

External types include things like:

```txt
AbortSignal
Promise
HTMLElement
ReactNode
Date
URL
```

Represent them as external terminal nodes.

Hide them by default or display them in a muted style.

---

## 12. Display text rules

The inspector should preserve readable authored type structure.

Prefer source-level declaration text over huge compiler-expanded anonymous types.

Bad inspector output:

```ts
type CheckoutInput = {
  cart?: {
    id: CartId;
    items: readonly CartItem[];
  }[];
}
```

Good inspector output:

```ts
type CheckoutInput = {
  cart?: CartSnapshot | undefined;
}
```

The rule:

```txt
The inspector shows the selected node independently.
It does not recursively inline referenced nodes.
Named type references remain named and clickable.
```

For imported references, display the imported name.

---

## 13. Scope behavior

There are two concepts:

### Index scope

Usually full project.

This allows correct cross-file type resolution.

### View scope

What the GUI initially shows or filters to.

Example:

```bash
tg show ./src/orders
```

This should:

```txt
Index full project
Set initial view scope to ./src/orders
```

Nodes outside the scope can still appear if they are dependencies of in-scope nodes. Style them as outside current scope.

The GUI should allow changing scope after launch.

---

## 14. GUI behavior

Build a three-panel interface:

```txt
┌────────────────────────────────────────────────────────────────────┐
│ TypeGraph                                                         │
├───────────────┬──────────────────────────────────────┬─────────────┤
│ Search/Scope  │ Graph canvas                         │ Inspector   │
│               │                                      │             │
│ Search box    │ Focused current node                 │ type Foo... │
│ Dir filter    │ Direct dependencies                  │ Members     │
│ Kind filters  │ Direct dependents                    │ Depends on  │
│ Result list   │ Expand/collapse graph                │ Used by     │
│               │                                      │ Source      │
└───────────────┴──────────────────────────────────────┴─────────────┘
```

---

### Left panel

Include:

* search box
* current project root
* current directory scope
* type list
* filters:

  * show/hide primitives
  * show/hide external types
  * exported only
  * kind filter: type alias/interface/class/enum
  * current directory only / whole project

Search result item should show:

```txt
CheckoutInput
type alias · src/orders/checkout.ts:12
depends on 5 · used by 3
```

Clicking a result selects the node and recenters the graph.

---

### Center graph canvas

Use React Flow.

Do not show the full codebase graph by default. That becomes a hairball.

Default graph neighborhood:

```txt
selected node
+ direct dependencies
+ direct dependents
```

Allow expansion:

* expand dependencies one hop
* expand dependents one hop
* collapse selected branch
* reset to selected node
* show path to primitive leaves
* show path to top dependents

Each node card should show:

```txt
CheckoutInput
type alias
8 members
depends on 5
used by 4
```

Edges should show labels where useful:

```txt
cart
customer
context
return
arg1
```

---

### Right inspector

The inspector is the most important part of the GUI.

When selecting a node, show:

1. Name
2. Kind
3. Source file and line
4. One-level display text
5. Members
6. Depends on
7. Depended on by
8. Source snippet

Type names inside the displayed shape should be clickable where possible.

Clicking a referenced type should:

1. Select that node.
2. Recenter the graph.
3. Update the inspector.
4. Preserve navigation history if straightforward.

---

## 15. Local API

Expose minimal local API endpoints from `src/server`.

Suggested endpoints:

```txt
GET /api/project
GET /api/graph
GET /api/node/:id
GET /api/search?q=CheckoutInput
GET /api/neighborhood?nodeId=...&depth=1&direction=both
POST /api/scope
GET /api/source?nodeId=...
```

Preferred graph payload shape:

```ts
type TypeGraphPayload = {
  projectRoot: string;
  tsconfigPath: string;
  scopePath?: string;
  indexedAt: string;
  nodes: TypeGraphNode[];
  edges: TypeGraphEdge[];
};
```

For small and medium projects, returning the full graph is acceptable.

For larger projects, the GUI should prefer neighborhood queries.

---

## 16. Watch mode

For `tg show`, enable watch mode by default.

When files change:

1. Debounce changes.
2. Re-index the project.
3. Notify GUI.
4. GUI shows “Graph updated.”
5. Preserve selected node if it still exists.

Do not over-optimize incremental indexing early. Full re-index is acceptable if performance is reasonable.

Use a debounce around 300-700ms.

---

## 17. Mock codebase playground

The mock codebase should be a small realistic TypeScript project.

Purpose:

```txt
Give TypeGraph a real target project during development.
Test the actual product experience, not just unit-level extraction.
```

It should include layered type dependencies:

```txt
primitive aliases
  ↓
domain models
  ↓
catalog and inventory models
  ↓
cart and checkout types
  ↓
app state / command types
```

Example files:

```txt
playground/mock-codebase/src/domain/primitives.ts
playground/mock-codebase/src/domain/users.ts
playground/mock-codebase/src/domain/addresses.ts
playground/mock-codebase/src/catalog/products.ts
playground/mock-codebase/src/catalog/inventory.ts
playground/mock-codebase/src/orders/cart.ts
playground/mock-codebase/src/orders/checkout.ts
playground/mock-codebase/src/app/state.ts
playground/mock-codebase/src/app/commands.ts
```

The mock codebase should include:

* primitive aliases
* object type aliases
* interfaces
* imported type references
* function type aliases
* nested domain models
* union types
* intersection types
* enums
* arrays
* readonly arrays
* optional properties
* external types like `AbortSignal`
* a few generic wrapper types if easy

The mock domain itself is not important. Keep it small, generic, and designed only to exercise TypeGraph behavior. Do not encode assumptions from another real project into the playground.

Important:

```txt
The mock codebase must not import TypeGraph source code.
TypeGraph source code must not import the mock codebase.
The mock codebase is only a target path passed into the CLI.
```

Good:

```bash
tg show playground/mock-codebase
```

Bad:

```ts
import { mockTypes } from "../../playground/mock-codebase";
```

---

## 18. Mock codebase example content

### `domain/primitives.ts`

```ts
export type UserId = string;
export type ProductId = string;
export type CartId = string;
export type OrderId = string;
export type ISODateString = string;
export type MoneyCents = number;

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };
```

### `domain/users.ts`

```ts
import type { UserId, ISODateString } from "./primitives";
import type { PostalAddress } from "./addresses";

export type UserProfile = {
  id: UserId;
  name: string;
  email?: string;
  defaultAddress?: PostalAddress;
  createdAt: ISODateString;
};
```

### `domain/addresses.ts`

```ts
export interface PostalAddress {
  line1: string;
  line2?: string;
  city: string;
  countryCode: string;
  postalCode: string;
}
```

### `catalog/products.ts`

```ts
import type { ProductId, MoneyCents, JsonValue } from "../domain/primitives";

export enum ProductStatus {
  Draft = "draft",
  Active = "active",
  Archived = "archived",
}

export type ProductVariant = {
  sku: string;
  label: string;
  price: MoneyCents;
  metadata?: JsonValue;
};

export type ProductRecord = {
  id: ProductId;
  title: string;
  status: ProductStatus;
  variants: readonly ProductVariant[];
  tags?: readonly string[];
};
```

### `catalog/inventory.ts`

```ts
import type { ProductId } from "../domain/primitives";

export type InventoryLocation = "warehouse" | "storefront" | "supplier";

export interface InventoryRecord {
  productId: ProductId;
  available: number;
  reserved: number;
  location: InventoryLocation;
}
```

### `orders/cart.ts`

```ts
import type { CartId, ProductId, MoneyCents, ISODateString } from "../domain/primitives";
import type { ProductRecord } from "../catalog/products";

export type CartItem = {
  productId: ProductId;
  product: ProductRecord;
  quantity: number;
  unitPrice: MoneyCents;
};

export type CartSnapshot = {
  id: CartId;
  items: readonly CartItem[];
  updatedAt: ISODateString;
};
```

### `orders/checkout.ts`

```ts
import type { OrderId, ISODateString } from "../domain/primitives";
import type { UserProfile } from "../domain/users";
import type { CartSnapshot } from "./cart";

export interface RequestContext {
  requestId: string;
  signal?: AbortSignal;
  referrer?: URL;
}

export type CheckoutInput = CartSnapshot & {
  customer: UserProfile;
  context: RequestContext;
};

export type CheckoutSuccess = {
  ok: true;
  orderId: OrderId;
  placedAt: ISODateString;
};

export type CheckoutFailure = {
  ok: false;
  reason: "payment_failed" | "out_of_stock" | "invalid_cart";
};

export type CheckoutResult = CheckoutSuccess | CheckoutFailure;

export type CheckoutHandler = (input: CheckoutInput) => Promise<CheckoutResult>;
```

### `app/state.ts`

```ts
import type { UserProfile } from "../domain/users";
import type { ProductRecord } from "../catalog/products";
import type { CartSnapshot } from "../orders/cart";
import type { CheckoutResult } from "../orders/checkout";

export type StoreState = {
  currentUser?: UserProfile;
  catalog: readonly ProductRecord[];
  cart?: CartSnapshot;
  lastCheckout?: CheckoutResult;
};
```

### `app/commands.ts`

```ts
import type { ProductId } from "../domain/primitives";
import type { CheckoutInput } from "../orders/checkout";

export type StoreCommand =
  | { type: "addItem"; productId: ProductId; quantity: number }
  | { type: "removeItem"; productId: ProductId }
  | { type: "checkout"; input: CheckoutInput };
```

---

## 19. Tests

Add tests for the graph extractor and graph query logic.

Use small fixture projects in `tests/fixtures`.

Required test cases:

### Basic primitive object

Input:

```ts
type TypeA = {
  id: number;
  name: string;
  content: unknown;
};
```

Expected:

```txt
TypeA exists
TypeA -> number
TypeA -> string
TypeA -> unknown
```

---

### Function type alias

Input:

```ts
type TypeB = (arg1: string, arg2: number) => TypeA;
```

Expected:

```txt
TypeB exists
TypeB -> string via arg1
TypeB -> number via arg2
TypeB -> TypeA via return
```

---

### Composed object

Input:

```ts
type TypeC = {
  id: string;
  count: number;
  content: TypeB;
};
```

Expected:

```txt
TypeC exists
TypeC -> TypeB via content
display text preserves content: TypeB
```

---

### Interface extends

Input:

```ts
interface Child extends Parent {
  value: Value;
}
```

Expected:

```txt
Child -> Parent kind extends
Child -> Value kind property
```

---

### Union/intersection

Input:

```ts
type Result = Success | Failure;
type Combined = A & B;
```

Expected:

```txt
Result -> Success
Result -> Failure
Combined -> A
Combined -> B
```

---

### Imported project-local type

Input:

```ts
import type { Foo } from "./foo";

type Bar = {
  foo: Foo;
};
```

Expected:

```txt
Bar -> Foo
Foo resolves to project-local node
```

---

### External type

Input:

```ts
type Request = {
  signal?: AbortSignal;
};
```

Expected:

```txt
Request -> AbortSignal
AbortSignal is marked external
```

---

## 20. Manual smoke test checklist

After running:

```bash
npm run dev:mock
```

Check:

1. GUI opens locally.
2. Search for `CheckoutInput`.
3. Inspector shows one-level shape.
4. `CartSnapshot` is clickable.
5. `UserProfile` is clickable.
6. `RequestContext` is clickable.
7. `AbortSignal` appears as external, not project-local.
8. `URL` appears as external, not project-local.
9. Graph shows direct dependencies of `CheckoutInput`.
10. Graph shows direct dependents of `CheckoutInput`, such as `StoreCommand`.
11. Search for `JsonValue`.
12. Union/recursive-ish shape does not crash extractor.
13. Search for `CheckoutHandler`.
14. Function params and return type appear as edges.
15. Running scoped command against `src/orders` starts with order types but still resolves dependencies in `domain` and `catalog`.
16. Primitives are hidden by default but can be shown if toggle exists.
17. `npm run export:mock` writes graph JSON.
18. `npm run build` succeeds.
19. `npm run start -- show playground/mock-codebase` works after build.
20. `npm link` then `tg show playground/mock-codebase` works.

---

## 21. Separation rules

Good dependency direction:

```txt
src/cli
  → src/core
  → src/shared

src/server
  → src/core
  → src/shared

src/web
  → src/shared only
```

Avoid:

```txt
src/web → src/core
```

The browser GUI should not import TypeScript compiler analysis logic.

Avoid:

```txt
src/core → src/web
src/core → playground/mock-codebase
src/server → playground/mock-codebase
```

The mock codebase is only a target project. It should never be imported by TypeGraph source.

---

## 22. Implementation order

Implement in this order:

1. Create root npm project.

2. Add long-term structure:

   * `src/cli`
   * `src/server`
   * `src/core`
   * `src/shared`
   * `src/web`
   * `tests/fixtures`
   * `playground/mock-codebase`

3. Add shared graph model types in `src/shared/graphTypes.ts`.

4. Add mock codebase with its own `package.json` and `tsconfig.json`.

5. Implement CLI command skeleton:

   * `show`
   * `index`
   * `export`

6. Implement project discovery:

   * target path resolution
   * nearest `tsconfig.json`
   * project root detection
   * view scope detection

7. Implement graph extraction:

   * type aliases
   * interfaces
   * primitive references
   * imported project-local references
   * function type aliases

8. Implement reference resolution:

   * project-local symbols
   * external symbols
   * primitive terminal nodes

9. Implement graph querying helpers:

   * get node
   * search nodes
   * get dependencies
   * get dependents
   * get neighborhood

10. Implement `tg export` first.

    * This allows graph output debugging before GUI complexity.

11. Add unit tests using `tests/fixtures`.

12. Implement `tg index`.

13. Implement local server.

14. Implement basic API endpoints.

15. Implement minimal web GUI:

    * search
    * selected node inspector
    * depends-on list
    * depended-on-by list

16. Add React Flow graph canvas.

17. Add scope support:

    * `tg show <path>`
    * GUI scope selector

18. Add watch mode.

19. Add source preview.

20. Add build scripts:

    * lint
    * typecheck
    * build:web
    * build:node
    * build

21. Test built CLI:

```bash
npm run build
node dist/cli.js show playground/mock-codebase
```

22. Test linked CLI:

```bash
npm link
tg show playground/mock-codebase
```

---

## 23. Acceptance criteria

The implementation is acceptable when:

1. `npm run dev:mock` launches the GUI against the mock codebase.

2. `npm run dev:mock:orders` launches the GUI scoped to the mock orders folder.

3. `npm run export:mock` writes graph JSON.

4. `npm test` passes fixture tests.

5. `npm run lint` passes.

6. `npm run typecheck` passes.

7. `npm run build` produces:

   * `dist/cli.js`
   * compiled Node support files under `dist/cli`, `dist/server`, `dist/core`, and `dist/shared`
   * `dist/web/index.html`
   * `dist/web/assets/*`

8. `node dist/cli.js show playground/mock-codebase` works.

9. `tg show playground/mock-codebase` works after `npm link`.

10. The mock codebase can be deleted without breaking TypeGraph source build.

11. The mock codebase is excluded from TypeGraph’s own TypeScript build.

12. The GUI can inspect `CheckoutInput`.

13. The GUI can click referenced types.

14. The GUI can navigate dependencies and dependents.

15. The inspector shows one-level declared shape, not recursive expanded blobs.

16. Primitives and external types are handled without overwhelming the default graph view.

17. `tg show <path>` indexes the full project but starts with the selected path as view scope.

---

## 24. Final mental model

During development:

```txt
TypeGraph source code
  ↓
npm run dev:mock
  ↓
runs CLI through tsx
  ↓
indexes playground/mock-codebase
  ↓
serves local GUI through Vite dev serving
  ↓
developer manually verifies graph behavior
```

After build:

```txt
npm run build
  ↓
dist/cli.js
  ↓
starts local server
  ↓
serves dist/web
  ↓
indexes any target TS project
```

After linking:

```txt
npm link
  ↓
tg show some-project
  ↓
same local GUI experience
```

The final product should feel like:

```txt
IDE hover card
+ clickable type references
+ dependency graph
+ reverse dependency graph
+ local web GUI
+ CLI ergonomics
```

The core rule:

```txt
The inspector explains one type at a time.
The graph provides navigation around that type.
```
