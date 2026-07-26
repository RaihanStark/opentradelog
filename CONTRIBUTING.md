# Contributing to OpenTradeLog

Thanks for your interest! OpenTradeLog is MIT-licensed and community-driven.

## Principles (please preserve these)

1. **Local-first, no telemetry.** The app must never phone home. The only network calls allowed are user-configured broker syncs.
2. **The user owns their data.** Everything stays in the user's vault folder in open, documented formats. Any schema change must update `SCHEMA_VERSION`, `schema.md`, and keep the vault round-trip lossless.
3. **Firm-agnostic core.** Don't hard-code Topstep. New prop firms are added as rule profiles under `src/main/domain/rules/`.
4. **Money is integer cents. Timestamps are ISO-8601 UTC.** Session dates are `America/Chicago` with a 17:00 rollover.

## Getting started

```bash
pnpm install
pnpm dev
pnpm test        # keep these green
pnpm typecheck
```

Requires Node 20+ and a C/C++ toolchain (for `better-sqlite3`).

## Where things live

- `src/main/domain/` — pure, tested logic: round-trip grouping, rule profiles, analytics.
- `src/main/core/` — DB-backed services (accounts, ingest, trades, rules, dashboard, journal).
- `src/main/vault/` — vault manager + open-format mirror/import.
- `src/main/ipc/` + `src/preload/` — the typed bridge to the UI.
- `src/renderer/` — the React app.
- `src/shared/` — DTOs and the IPC contract shared across processes.

## Pull requests

- Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`…).
- Add/extend Vitest tests for domain logic and the data pipeline.
- Run `pnpm build` (typecheck + bundle) before opening a PR.
