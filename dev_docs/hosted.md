# Hosted GitHub Mode

Hosted mode is a static browser app. It has no backend and does not use GitHub authentication.

## Runtime Selection

`src/web/runtimeMode.ts` treats `localhost`, `127.0.0.1`, and `::1` as local mode. Any other hostname uses hosted mode.

Local mode still loads `/api/graph`, listens to `/api/events`, and uses the local Fastify server. Hosted mode starts from `HostedRepositoryEntry`, asks for a GitHub URL, and sends analysis work to a module worker.

## GitHub URL Scope

Hosted URLs support:

- repo root: `https://github.com/owner/repo`
- branch or tag: `https://github.com/owner/repo/tree/ref`
- subdirectory: `https://github.com/owner/repo/tree/ref/path/to/dir`
- blob URLs as a narrow single-file input, with displayed scope set to the file's directory.

If no ref is present, hosted mode uses the repository default branch. For `/tree/...` and `/blob/...` URLs, branch names may contain slashes, so `resolveGitHubRefAndPath` tests the longest possible ref candidate first and treats the remaining segments as the repo-relative path.

## Repository Fetching

`src/web/hosted/githubRepository.ts` uses GitHub REST API calls only. It resolves the selected ref to a commit SHA and tree SHA, then:

- fetches the root tree recursively for repo-root URLs.
- walks non-recursive tree entries to a selected subtree before fetching that subtree recursively.
- downloads raw files by commit SHA from `raw.githubusercontent.com`, avoiding branch-name ambiguity.

Downloaded files are limited to TypeScript source files plus `tsconfig*.json` and `package.json`. Hosted mode keeps the same local exclusions for `node_modules`, `dist`, and `.tmp`. External package types are intentionally not hydrated; unresolved package/library references remain external terminal nodes.

If GitHub reports a truncated tree, hosted mode fails with a prompt to use a smaller subdirectory URL instead of indexing partial data.
