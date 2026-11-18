# TASK-001 Architecture

Inputs: `tasks/TASK-001/requirements.md` (Q1–Q3), `API_CONTRACT.md`, `MOCKING_GUIDE.md`, `rulesets/common/architect/*`, `rulesets/framework/architect/INDEX.md`.
Application Root: repository root. Existing structure: Vite scaffold only (`src/main.tsx`, `src/App.tsx`), no router, no state or data library, no test runner, no `specs/`. `msw@2.14.6` installed; `public/mockServiceWorker.js` present.

Status legend: **DECIDED** (no new dependency, reversible) · **PENDING HUMAN CHOICE** (new dependency).

## D1 Routing and URL state — DECIDED (Q1)

**Decision:** no router dependency. The single view keeps shareable state in URL search params, read and written through one small `useUrlState` hook using `URLSearchParams`, `history.pushState`/`replaceState`, and `popstate`.

| Param | Meaning | History |
| --- | --- | --- |
| `query` | search text | `replaceState` (typing must not flood history) |
| `status` | one `SessionStatus` | `pushState` |
| `session` | open details id | `pushState` (Back closes details) |
| `create` | `1` when the create form is open | `pushState` |

**Rationale:** one view plus overlays does not need path routing. This approach gives deep links, Back/Forward, and preserved list context (AC-1.6, AC-2.3, AC-2.4) with no new dependency. URL sync of filters is an optional extension in the spec; it comes free here because the list context has to survive opening details anyway.

**Rejected:** react-router (new dependency and config for one view); in-memory-only details (loses deep links and Back behavior).

**Implications:** the URL is the single owner of filter and selection state. Components derive from it and never mirror it in `useState`. Unknown `status` values are ignored. Unknown `session` ids go to the details 404 path.

## D2 Server-state ownership — DECIDED (Q2)

**Decision:** no data library. Remote data is owned by feature hooks built on one generic `useAsync`-style primitive inside the sessions feature:

- `useSessions({ query, status })` refetches when params change; aborts the stale request with `AbortController`; keeps previous data visible while refetching and exposes `{ status: 'loading'|'success'|'error', data, error, retry }`.
- `useSessionDetails(id)` and `useCoaches()` follow the same shape.
- `createSession(input)` is a plain async client call. The form owns `pending` locally. On success it calls `sessions.retry()` (refetch) — no client-side cache patching, so the server list remains the only source of truth.

**Rationale:** three reads and one write do not justify TanStack Query or SWR (spec: do not add a data library just because React rules mention patterns). AbortController covers race conditions on fast filter changes.

**Rejected:** TanStack Query (dependency, cache semantics unnecessary at this scale); a global store (one feature, no cross-feature sharing).

**Risk:** no request de-duplication or caching. Reopening details refetches, which is acceptable at fixture scale.

## D3 Module boundaries and dependency direction — DECIDED

```
src/
  api/            client.ts (fetch + ApiError normalization), types.ts (contract types), dates.ts (parse/format boundary)
  features/sessions/
                  hooks (useSessions, useSessionDetails, useCoaches), validation.ts (pure create rules), components
  lib/            useUrlState.ts
  mocks/          browser.ts, node.ts, handlers.ts, db.ts (in-memory store + rebasing), scenario.ts
  main.tsx        starts the MSW worker (when enabled) before rendering
```

Dependency rules:

1. `components → hooks → api`. Components never call `fetch`.
2. `api/` never imports `mocks/` or fixture JSON.
3. Only `mocks/` imports `frontend-accelerator-assessment/fixtures/*` (read-only; the assessment directory is never written).
4. Scenario names exist only in `mocks/scenario.ts` and handlers.
5. `validation.ts` is pure and shared by the form and its tests. It never imports React.

Detailed client shape, error mapping, and scenario selection belong to `api-integration` (Q4). Component structure belongs to `ui-designer` (Q5).

## D4 Mock bootstrap and scenario selection — DECIDED (boundary only)

- `main.tsx` awaits `worker.start({ onUnhandledRequest: 'bypass' })` before `createRoot`. Mocks are always on in this assessment app because there is no real backend. A real backend would remove this one call.
- Scenario is chosen once at mock startup (mechanism details: `api-integration`), held in `mocks/scenario.ts`, and consulted only by handlers.
- Fixture rebasing runs once in `mocks/db.ts` with an injectable `now`, so tests pass a frozen instant through the same function.

## D5 Failure containment — DECIDED

- List, details, coaches, and create failures each render inline with a retry next to the region that failed. The app shell, filters, and header stay usable.
- One top-level React error boundary around the app catches unexpected render errors. It is not used for request errors.
- A details failure does not clear the list. A coaches failure disables only create submission.

## D6 Test stack — DECIDED: Option A (developer-selected, 2026-11-18) (Q3)

Reason recorded for new dev dependencies: the spec requires 4–6 behavior-level tests and no runner exists. Option A gives the most realistic keyboard and focus simulation for the accessibility-critical flows, and it reuses the Vite config. Trade-off: 5 dev dependencies, plus a slower DOM than happy-dom.

Nothing is installed. Any option adds dev dependencies and needs a recorded reason (spec Constraints). Every option runs the same MSW handlers through `msw/node` (`setupServer`), with a frozen clock (`vi.useFakeTimers({ toFake: ['Date'] })` or an injected `now`).

| Option | Dev deps | Trade-off |
| --- | --- | --- |
| **A (recommended)** Vitest + `@testing-library/react` + `@testing-library/user-event` + `@testing-library/jest-dom` + `jsdom` | 5 | Reuses `vite.config.ts`. Realistic keyboard and typing. The common default. |
| B Same as A with `happy-dom` instead of `jsdom` | 5 | Faster, but lower fidelity for focus and `<dialog>` edge cases that AC-2.2 relies on. |
| C Vitest + `@testing-library/react` + `jsdom` only | 3 | Fewer deps. `fireEvent` is less realistic for keyboard flows, and assertions are wordier. |

Option A adds a `test` script (`vitest run`) and a `test` block in `vite.config.ts` (environment, setup file). Documentation check through `toolchain/bin/ctx7.mjs` was not run, so documentation evidence is **degraded**. Versions get pinned at install time by the `coder`.

## Security and performance notes

- No credentials, analytics, or personal data. Fixtures are synthetic.
- Render user-entered text as React text only, never as HTML.
- Debounce search (~250 ms) and abort superseded list requests.

## Readiness

D1–D6 are decided. Next: `api-integration` (Q4) and `ui-designer` (Q5). `specs/architecture.md` is not written because nothing is implemented yet.
