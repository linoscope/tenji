# Tenji — project conventions

Tenji is a **pure-frontend** personal webapp for planning a photo exhibition: define
walls in cm, place photos at real-world print sizes, arrange them, export. No backend,
no auth, no network at runtime. Data lives in the browser (IndexedDB).

## Stack & commands

- Vite 5 + React 18 + TypeScript. Vitest 2 + @testing-library/react (jsdom). `idb-keyval` for storage.
- Node 18 on this machine — versions are pinned to Vite 5 / Vitest 2. Do not bump to versions that need Node 20+.
- `npm test` — run the suite once (Vitest). `npm run test:watch` to watch.
- `npm run build` — typecheck (`tsc -b`) + production build. Must pass.
- `npm run lint` — ESLint. Must pass.
- `npm run dev` — dev server.

## Architecture (established in the scaffold slice — follow it)

Keep real logic in **pure, directly-testable modules**; treat React / drag libs / IndexedDB as thin shells.

- `src/state/` — `appReducer(state, action)` is the single source of truth, **pure and deterministic**. Callers supply ids (e.g. wall/photo/placement ids) in the action payload so the reducer never calls `crypto.randomUUID`/`Date.now`. State shape: `{ photos, walls, placements, ui }` (see `src/state/types.ts`). Add new actions to the existing `Action` union.
- `src/geometry/` — pure geometry helpers (e.g. `computeFitScale`, `cmToPx`). No React.
- `src/storage/` — `StatePort` interface with `load()`/`save()`. `createMemoryStatePort` is the in-memory fake used in tests; `createIdbStatePort` is production. Inject the port into `App` for tests.
- `src/ui/` — presentational components. `App.tsx` wires reducer + port + an injected `createId`.

## Testing rules

- **Test external behavior, not implementation.** A test should survive an internal refactor.
- TDD in **vertical slices**: one failing test → minimal code → repeat. Never write all tests up front.
- Prefer driving behavior through the reducer and pure helpers (fast, stable). Use a few React Testing Library tests for component behavior, injecting `createMemoryStatePort` and a deterministic `createId`.
- Every change must leave `npm test`, `npm run build`, and `npm run lint` green.

## Git / PR conventions

- One branch per issue: `slice-<issue-number>-<slug>`.
- Commit messages end with a trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- PRs say `Closes #<n>` and check off the issue's acceptance criteria.
- Squash-merge.
