# TypeGraph

TypeGraph, a local developer tool for exploring the TypeScript type structure of a codebase. The tool parses a TypeScript project, discover type aliases, interfaces, function type aliases, classes/enums where relevant, and build a navigable type dependency graph, which can be inspected via a web GUI.

![TypeGraph](./assets/screenshot.jpeg)

## Development

```sh
npm install
npm run test
npm run lint
npm run typecheck
npm run dev:mock              # index and open GUI on mock codebase inside playground/
npm run dev -- show <path>    # index and open GUI on another TypeScript project
npm run dev -- export <path> --out graph.json  # index and export type graph as json
```

## Build And Run

```sh
npm run build
npm link                 # link tg/typegraph CLI from this repo

npm run start -- show <path>
npm run start -- export <path> --out graph.json

# or after linking run:
tg show <path>
tg export <path> --out graph.json
```