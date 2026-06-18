# Development Workflows

TypeGraph has two web application targets that share the graph explorer UI but use different entrypoints:

- the local explorer bundled with the npm CLI.
- the static hosted GitHub repository analyzer.

They are built separately so the npm package does not contain the hosted intake page or browser indexing worker.

## Local CLI Development

Use the existing CLI development commands:

```sh
npm run dev:mock
npm run dev -- show <path-or-github-url>
npm run dev -- index <path-or-github-url>
npm run dev -- export <path-or-github-url> --out typegraph.json
```

`show` starts Fastify for the local API and a Vite development server for the explorer. Local graph updates continue to use `/api/graph` and `/api/events`.

A bare CLI invocation is informational:

```sh
npm run dev
npm run dev -- --help
```

Both print the available commands. Functional work requires a command or target argument.

## Local CLI Build

The standard build produces the publishable npm artifact:

```sh
npm run build
```

Output is written to `dist/`:

```text
dist/
  cli.js
  cli/
  core/
  server/
  shared/
  web/
```

`dist/web` is local-only. It always expects the Fastify API and SSE endpoints and does not contain the hosted repository intake or browser indexing worker.

The publishable `dist` tree must not contain source maps. `verify:dist` rejects any `.map` file so future npm releases cannot include them accidentally.

## Hosted Development

The hosted app has a separate HTML root, React entrypoint, and Vite configuration:

```text
hosted/index.html
src/web/hostedMain.tsx
src/web/hosted/HostedApp.tsx
vite.hosted.config.ts
```

The hosted Vite root is `hosted/`. Its `/src` alias points back to the repository-level `src/` directory so the same entrypoint works in both development and production builds.

Run the hosted development server with:

```sh
npx vite --config vite.hosted.config.ts
```

The hosted entry always starts with `HostedRepositoryEntry`. It analyzes public GitHub repositories in a browser worker and then renders the shared `ExplorerApp`.

Runtime hostname detection is no longer used. The local entry always runs local API mode, while the hosted entry always runs hosted browser mode.

## Hosted Build And Deployment

Build the hosted static app with:

```sh
npm run build:hosted
```

Output is written to:

```text
dist-hosted/
```

Hosted deployments must run `npm run build:hosted` and deploy `dist-hosted`. A deployment that previously ran `npm run build` or deployed `dist/web` must be updated.

The hosted build still includes:

- the GitHub repository intake.
- browser-worker repository indexing.
- hosted metadata and social preview tags.
- icons and hosted public assets.
- the shared graph explorer.

## Dependencies

Browser UI packages are development dependencies because Vite bundles them into the generated web assets:

- React and React DOM.
- React Flow.
- ELK.
- Zustand.

They remain available during local and hosted development after `npm install`.

The npm package installs only the dependencies required by the CLI at runtime:

- Fastify and `@fastify/static`.
- Chokidar.
- ts-morph.

## Validation

Before publishing or reviewing a release:

```sh
npm run verify:publish
npm pack --dry-run
```

`verify:publish` runs tests, linting, typechecking, the local npm build, and checks that `dist/web` contains no hosted-only code.
