# TASK-001 Implementation Plan

Sources (all resolved, none pending): `requirements.md`, `architecture.md` (D1–D6, D6 = test stack option A), `api-integration.md`, `ui-design.md`.
Application Root: repository root. Owner of production code and essential tests: `coder`.

## Current → Intended

- **Current:** Vite scaffold demo (`src/App.tsx` counter, `App.css`, `index.css`, `assets/*`). `msw@2.14.6` is installed and `public/mockServiceWorker.js` exists. No test runner, no `test` script, no `tasks`-driven code.
- **Intended:** a single-view sessions workspace (list + details dialog + create dialog) driven by URL search params, a typed `fetch` client, feature hooks, an MSW mock layer with in-memory state, fixture rebasing and scenarios, plus 4–6 behavior tests.

## Pre-flight (step 0)

1. Install dev dependencies (D6 option A): `npm install -D vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom`. Record the resolved versions in `workflow-log.md` / the final report.
2. `package.json`: add `"test": "vitest run"`. Keep the other scripts unchanged.
3. `vite.config.ts`: switch to `defineConfig` from `vitest/config` (or add `/// <reference types="vitest/config" />`). Add `test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'] }`. Keep the React plugin.
4. `tsconfig.app.json`: change only if `tsc -b` fails. The candidates are `resolveJsonModule: true` (fixture imports from `frontend-accelerator-assessment/fixtures`) and `vitest/globals` is **not** needed (tests import from `vitest`). Do not touch `tsconfig.node.json` unless the vitest config type requires it.
5. `index.html`: `<title>Training sessions</title>`. `lang="en"` is already present.

## Files

### Delete (scaffold demo, unrelated to the product)
- `src/App.css`, `src/assets/hero.png`, `src/assets/react.svg`, `src/assets/vite.svg`. Keep `public/favicon.svg` and `public/icons.svg` (harmless).

### `src/api/` — client boundary (api-integration §2)
| File | Purpose / contract |
| --- | --- |
| `types.ts` | Contract types verbatim; ISO strings stay `string`. |
| `client.ts` | `ApiClientError {status, code, message, fieldErrors?}`; private `request<T>`; `listSessions`, `getSession`, `listCoaches`, `createSession`. Omit empty params. Synthetic codes `NETWORK_ERROR` (status 0) and `INVALID_RESPONSE`. Rethrow `AbortError`. Carry the `shortcut:` comment about not validating the response shape. |
| `dates.ts` | `formatDateTime`, `formatDate`, `formatTime`, `formatLongDateTime` (Intl, local); `toStartsAt(date, time)` → UTC ISO; `isFuture(iso, now)`. An invalid ISO formats as `—`. |

### `src/lib/`
| File | Purpose / contract |
| --- | --- |
| `useUrlState.ts` | `useUrlState()` → `{ params: { query, status, session, create }, setParams(patch, { replace? }) }`. Read with `URLSearchParams`; write with `pushState`/`replaceState`; subscribe to `popstate` through `useSyncExternalStore`. **Preserves unknown params** (`scenario`). Unknown `status` → treated as empty. |

### `src/features/sessions/` — feature
| File | Purpose / contract |
| --- | --- |
| `useRemote.ts` | Generic `useRemote<T>(fetcher | null, deps)` → `{ status, data, error, isRefreshing, retry }` with an `AbortController` per run; ignores `AbortError`; keeps previous data while refetching (architecture D2). |
| `hooks.ts` | `useSessions({query,status})` (wraps `useRemote`, query debounced 250 ms), `useSessionDetails(id)` (clears data on id change), `useCoaches(enabled)`. |
| `validation.ts` | Pure `validateCreate(values, now)` → `Record<field, message>`, using the rules in requirements AC-3.2 (trimmed). `toCreateRequest(values)` → `CreateSessionRequest`, with blank optionals → `null`. `matchesFilters(session, {query,status})` decides which affordance the success banner offers. No React imports. |
| `labels.ts` | Display maps: type, status (label + symbol), visibility. Shared by table, details, and form. |
| `SessionsWorkspace.tsx` | Page: heading, Create button, toolbar, results region, success banner, polite live region. Owns the banner state. Renders the dialogs from URL params. Calls `sessions.retry()` after create. |
| `SessionsToolbar.tsx` | Search, status select, conditional Clear filters, count. |
| `SessionsTable.tsx` | Table with explicit roles and `data-label`; the title link with `href` built from the current params, plain click → `setParams({session})`. Records the opener for focus return. |
| `ListState.tsx` | Loading, empty, no-matches, and error blocks (ui-design §4). It may live inside `SessionsWorkspace.tsx` if it stays small. |
| `SessionDetailsDialog.tsx` | Details content, 404 vs error branching on `error.status`, cancellation group, "None" for nulls. |
| `CreateSessionDialog.tsx` | Form state, validation timing, pending guard (early return + disabled), server `fieldErrors` mapping (`startsAt` → date/time slot; unknown keys → form-level), focus to the first invalid field or form alert, coaches loading/error/empty states, dirty-close `confirm`. Calls `onCreated(session)`. |

### `src/components/` — shared UI (ui-design §8)
`Dialog.tsx` (native `<dialog>`, `showModal` on mount, `close` event → `onClose`, `aria-labelledby`, focus heading, return focus), `StatusBadge.tsx`, `Field.tsx` (label/hint/error id wiring), `InlineAlert.tsx` (role alert + optional Retry).

### `src/mocks/` — mock boundary (api-integration §5)
| File | Purpose / contract |
| --- | --- |
| `db.ts` | `rebase(iso, now, referenceNow)`; `createDb({ now, empty? })` seeds from the details fixtures (summary derived from details), and exposes `list({query,status})`, `get(id)`, `create(req)`, `coaches`. The only importer of fixture JSON besides `scenario.ts`. |
| `scenario.ts` | `getScenario()`, `setScenario(name)`, `scenarioFromUrl()`; reads `mock-scenarios.json`; unknown → `normal`. |
| `handlers.ts` | `createHandlers(getDb)`: the four endpoints, scenario overrides, `delay(latency)` (250 in the browser, 0 in tests), `400 INVALID_FILTER`, POST validation → `400 VALIDATION_FAILED` + `fieldErrors`, 201. |
| `browser.ts` | `startMocks()`: scenario from the URL, `createDb({ now: new Date(), empty: scenario==='empty' })`, `setupWorker(...).start({ onUnhandledRequest: 'bypass' })`. |
| `node.ts` | `setupServer` + a `resetMocks({ now, scenario })` helper for tests. |

### Wiring
| File | Change |
| --- | --- |
| `src/main.tsx` | `await startMocks()` then render `<App />` (top-level await or `.then`). |
| `src/App.tsx` | Replace the demo: skip link, header, `<main id="main">`, error boundary (small class component inline or in `src/components/ErrorBoundary.tsx`), `<SessionsWorkspace />`. |
| `src/index.css` | Replace with token custom properties, base typography, focus-visible outline, `.visually-hidden`, table → stacked reflow < 768px, dialog panel/full-screen styles, reduced-motion guard. Use one stylesheet; no CSS framework. |
| `README.md` | Replace the template text: what the app is, `npm install`, `npm run dev`, `npm test`, `npm run build`, `npm run lint`, and scenario selection via `?scenario=<name>` with the list of required names. |

### Tests (essential, owned by `coder`)
| File | Purpose |
| --- | --- |
| `src/test/setup.ts` | `@testing-library/jest-dom/vitest`; MSW server `listen({ onUnhandledRequest: 'error' })`, `resetHandlers` + `resetMocks` after each, `close` after all; `vi.setSystemTime(referenceNow)` (Date only) so rebased fixtures equal the raw fixtures. jsdom lacks `HTMLDialogElement.showModal`, so polyfill `showModal`/`close` minimally here (set and remove the `open` attribute, dispatch `close`). |
| `src/features/sessions/SessionsWorkspace.test.tsx` | Behavior tests below. |

## Steps (dependency order)

1. **Step 0** pre-flight (deps, config, script).
2. **API layer:** `api/types.ts`, `api/dates.ts`, `api/client.ts`.
3. **Mock layer** (depends on 2's types): `mocks/db.ts`, `scenario.ts`, `handlers.ts`, `browser.ts`, `node.ts`. Wire `main.tsx`. Checkpoint: `npm run dev` with `fetch('/api/sessions?status=full')` in the console returns 1 item, `meta.total: 1`.
4. **State plumbing** (independent of 3): `lib/useUrlState.ts`, `features/sessions/useRemote.ts`, `hooks.ts`, `validation.ts`, `labels.ts`.
5. **Shared components + CSS** (independent of 3–4): `components/*`, `index.css`.
6. **Feature UI** (needs 2–5): toolbar + table + list states → details dialog → create dialog → success banner/discoverability. Replace `App.tsx`; delete scaffold files.
7. **Tests** (needs 3, 6): setup + behavior tests; run them.
8. **README** and `index.html` title.

Steps 4 and 5 can run in parallel with step 3.

## Essential Tests (4–6, behavior-level, through MSW node handlers)

| # | Test | Covers |
| --- | --- | --- |
| T1 | Initial load shows "Loading sessions…", then 5 rows; typing "maya" in search → only Maya Brooks sessions; choosing Status "Cancelled" → "Weekend Ball Handling" only | loading, populated, search, status (server-side filtering) |
| T2 | Search "zzz" → "No sessions match your filters" + Clear filters restores 5 rows; scenario `empty` → "No sessions yet" | no matches vs no sessions |
| T3 | Scenario `list-error` → alert with "Sessions cannot be loaded right now."; switch scenario to normal + Retry → rows | list error + recovery |
| T4 | Create: submit empty → field errors (title, coach, location, capacity, date/time) with `aria-invalid`, no POST | client validation |
| T5 | Create valid → success banner with Open session; the new title appears in the list; with Status "Cancelled" active → banner offers Reset filters | success + discoverability |
| T6 | Scenario `create-error` → form alert, values (title, location) still present, submit re-enabled | server failure preserves input |

Use `userEvent.setup({ advanceTimers })` only if fake timers affect debounce; otherwise fake only `Date` (`vi.useFakeTimers({ toFake: ['Date'] })`) and rely on `findBy*` for the real 250 ms debounce.

### Additional risk-based opportunities (not required; `test-generator` if wanted)
- `rebase` and `toStartsAt` unit checks across a DST boundary.
- Details deep link (`?session=ses_101`) + `details-error` + 404 `ses_unknown`.
- Coaches error disables submit.
- Duplicate submit: two rapid clicks → one POST (count requests in the handler).
- URL state: Back closes details and restores the filter.

## Verification Commands (from `package.json`)

| Command | Exists today |
| --- | --- |
| `npm run build` (`tsc -b && vite build`) | yes |
| `npm run lint` | yes |
| `npm test` | added in step 0 |
| `npm run dev` | yes, for browser verification (URL comes from Vite output; no port is assumed) |

## Risks and Notes

- **jsdom `<dialog>`:** not fully implemented. The setup polyfill is test-only; real focus trapping is verified in the browser.
- **Fixture JSON outside `src`:** Vite serves it fine. TS may need `resolveJsonModule` (step 0.4). This is read-only, so the assessment directory is never modified.
- **MSW in production build:** mocks always start (architecture D4). `vite preview` works offline because `mockServiceWorker.js` sits in `public/`.
- **Timezone in tests:** formatting depends on the runner's TZ. Assert on titles, counts, and messages, not formatted times.
- **Rollback:** a single-feature greenfield. Revert the commit(s); no flags needed.
- **Pre-implementation evidence:** create a git checkpoint commit containing all `tasks/TASK-001/*.md` before starting `coder`, and record its hash in `workflow-log.md` (EVIDENCE_PROTOCOL §2).

## Readiness

Actionable. The next role is `coder` with this plan (after the planning checkpoint commit).
