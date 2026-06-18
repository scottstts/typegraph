# Hosted GitHub Mode

Hosted mode is a static browser app. It has no backend and does not use GitHub authentication.

## Separate Build

Hosted mode is no longer selected at runtime by browser hostname. It has a separate entrypoint at `src/web/hostedMain.tsx`, a separate application wrapper at `src/web/hosted/HostedApp.tsx`, and a separate Vite root/config under `hosted/` and `vite.hosted.config.ts`.

`npm run build` emits the CLI package and local-only explorer into `dist`. `npm run build:hosted` emits the static hosted app into `dist-hosted`. Hosted mode starts from `HostedRepositoryEntry`, asks for a GitHub URL, and sends analysis work to a module worker.

## GitHub URL Scope

Hosted URLs support:

- repo root: `https://github.com/owner/repo`
- branch or tag: `https://github.com/owner/repo/tree/ref`
- subdirectory: `https://github.com/owner/repo/tree/ref/path/to/dir`
- blob URLs as a narrow single-file input, with displayed scope set to the file's directory.

If no ref is present, hosted mode uses the repository default branch. For `/tree/...` and `/blob/...` URLs, branch names may contain slashes, so `resolveGitHubRefAndPath` tests the longest possible ref candidate first and treats the remaining segments as the repo-relative path.

## Repository Fetching

`src/core/githubRepository.ts` uses GitHub REST API calls only. It is shared by the deployed web worker and local CLI remote-repository commands. It resolves the selected ref to a commit SHA and tree SHA, then:

- fetches the root tree recursively for repo-root URLs.
- walks non-recursive tree entries to a selected subtree before fetching that subtree recursively.
- downloads raw files by commit SHA from `raw.githubusercontent.com`, avoiding branch-name ambiguity.

Downloaded files are limited to TypeScript source files plus `tsconfig*.json` and `package.json`. Hosted mode keeps the same local exclusions for `node_modules`, `dist`, and `.tmp`. External package types are intentionally not hydrated; unresolved package/library references remain external terminal nodes.

If GitHub reports a truncated tree, hosted mode fails with a prompt to use a smaller subdirectory URL instead of indexing partial data.

## Hosted Intake UI

The hosted intake page is intentionally a focused reception screen, not a full SaaS landing page. It keeps one repository URL form, a concise explanation of browser-side GitHub analysis, a GitHub source link to `scottstts/typegraph`, and a sibling `npm i -g @scottstts/typegraph` install tag. The install tag has a trailing copy button that writes the command to the clipboard and briefly changes to a check icon; denied clipboard access shows a short failure state instead of raising an unhandled error. The source and utility icons use Font Awesome loaded from `index.html`.
