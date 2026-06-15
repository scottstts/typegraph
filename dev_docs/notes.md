2026-06-15:
- Node build direction is `tsc` only, not `tsup`: keep `src/cli.ts` as the thin bin entrypoint so `tsc` emits `dist/cli.js`, with compiled support modules under `dist/cli`, `dist/server`, `dist/core`, and `dist/shared`.
- Development `tg show` commands run through `tsx src/cli.ts` and should serve/proxy the GUI through Vite dev serving; they must not require `dist/web` to exist. Built `node dist/cli.js show` serves `dist/web`.
- `playground/mock-codebase` is only a generic extraction/manual-testing target. Do not preserve or recreate the prior agent-specific domain; use small neutral fixtures that exercise TypeGraph behavior.
