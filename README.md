# TypeGraph

Explore the TypeScript type structure of a local project or public GitHub repository as an interactive dependency graph.

## Run without installing

```sh
npx @scottstts/typegraph show .
```

## Install globally

```sh
npm install --global @scottstts/typegraph

typegraph show .
typegraph export . --out typegraph.json
```

The shorter `tg` binary is also available after installation.

## Analyze a public GitHub repository

```sh
typegraph show https://github.com/owner/repo
typegraph export https://github.com/owner/repo --out typegraph.json
```

Repository root, branch, subdirectory, and blob URLs are supported. GitHub targets must be explicit `github.com` URLs.

## Commands

```text
typegraph
typegraph --help
typegraph show [path | github-url] [--project tsconfig.json]
typegraph index [path | github-url] [--project tsconfig.json]
typegraph export [path | github-url] [--out typegraph.json] [--project tsconfig.json]
```

- With no arguments, TypeGraph prints the available commands and options.
- `--help` and `-h` print the same help output.
- `show` indexes the target and starts the local web explorer.
- `index` prints a graph summary.
- `export` writes the complete graph as JSON. The default output is `typegraph.json`.
- `--project` selects a TypeScript config for local filesystem targets only.

Supplying a path or GitHub URL without a command still defaults to `show`.

## Requirements

- Node.js 20 or newer
- A TypeScript project with a discoverable `tsconfig.json`, unless analyzing a GitHub repository

## Local development

```sh
npm install
npm test
npm run lint
npm run typecheck
npm run build
npm run dev:mock
```

The npm package build contains the CLI, local server, graph engine, and local explorer. The separate hosted browser app is at: [TypeGraph](https://tg.scottsun.io)
