# TASK-001 API Integration

Inputs: `frontend-accelerator-assessment/API_CONTRACT.md`, `MOCKING_GUIDE.md`, `fixtures/*`, `tasks/TASK-001/requirements.md` (Q4), `tasks/TASK-001/architecture.md` (D1–D6), `rulesets/common/api-integration/*`.
Existing transport in repo: none (Vite scaffold), so this document defines it. No client library is introduced; the client uses native `fetch`.

## 1. Contract Classification

| Element | Class | Notes |
| --- | --- | --- |
| `GET /api/sessions?query&status` → `SessionsResponse` | Confirmed | Filtering happens in the handler; `meta.total` is counted after filtering; `page: 1`, `pageSize: 10`. |
| `400 INVALID_FILTER`, `500 SESSIONS_UNAVAILABLE` | Confirmed | The client never sends an invalid status, so 400 is reachable only through a hand-edited request. |
| `GET /api/sessions/:id` → `SessionDetails`; `404 SESSION_NOT_FOUND`, `500 SESSION_DETAILS_UNAVAILABLE` | Confirmed | |
| `GET /api/coaches` → `CoachesResponse`; `500 COACHES_UNAVAILABLE` | Confirmed | |
| `POST /api/sessions` `CreateSessionRequest` → `201 SessionDetails`; `400 VALIDATION_FAILED`, `500 CREATE_SESSION_FAILED` | Confirmed | |
| `fieldErrors` key names | **Assumed** | The contract says "where available" but names no keys. The mock uses `CreateSessionRequest` field names (`title`, `type`, `startsAt`, `durationMinutes`, `coachId`, `locationName`, `locationAddress`, `capacity`, `visibility`, `description`, `trainerNotes`). The client maps unknown keys to the form-level error. Confirmation would come from the backend owner; for the assessment, the evaluator. |
| Status of a newly created session | **Assumed** | The mock returns `scheduled`, `bookedCount: 0`, `cancellation: null`. |
| `409 COACH_SCHEDULE_CONFLICT`, cancel endpoint, permissions | Optional, not implemented | Out of scope per requirements. The client does not reference them. |
| Timeouts, retry policy, idempotency | Not in contract | Nothing is invented: no timeout, no automatic retry, no idempotency key. |
| `NETWORK_ERROR` / `INVALID_RESPONSE` codes | **Client-only** | Synthetic codes for failures that have no `ApiError` body. They are never presented as backend codes. |

No contract change is proposed.

## 2. Client Boundary (`src/api/`)

### `types.ts`
Copy the contract types verbatim (`SessionType`, `SessionStatus`, `Visibility`, `CoachSummary`, `LocationSummary`, `SessionSummary`, `SessionDetails`, `SessionsResponse`, `CoachesResponse`, `CreateSessionRequest`, `ApiError`). Timestamps stay `string` (ISO 8601 UTC) to match the wire format.

### `client.ts`
```ts
class ApiClientError extends Error {
  status: number;            // HTTP status, 0 for network failures
  code: string;              // contract code, or NETWORK_ERROR | INVALID_RESPONSE
  fieldErrors?: Record<string, string>;
}

listSessions(params: { query?: string; status?: SessionStatus }, signal?: AbortSignal): Promise<SessionsResponse>
getSession(id: string, signal?: AbortSignal): Promise<SessionDetails>
listCoaches(signal?: AbortSignal): Promise<CoachesResponse>
createSession(body: CreateSessionRequest): Promise<SessionDetails>
```

Rules:

1. One private `request<T>(path, init)` performs `fetch('/api' + path)` with `Accept: application/json`. POST also sends `Content-Type: application/json`.
2. Query building: trim `query` and omit empty values. `encodeURIComponent(id)` for path segments.
3. `!res.ok` → parse the body as `ApiError` and throw `ApiClientError(status, code, message, fieldErrors)`. If the body cannot be parsed, throw `INVALID_RESPONSE` with a generic message.
4. `fetch` rejects (offline) → `ApiClientError(0, 'NETWORK_ERROR', generic message)`.
5. `AbortError` is rethrown untouched. Hooks ignore it.
6. A 2xx response with invalid JSON → `INVALID_RESPONSE`. There is no runtime schema library. `shortcut:` this trusts the response shape beyond JSON parsing; add a schema validator if a real backend is untrusted.
7. User-facing text comes from `error.message` (server-provided and safe in fixtures) or a per-region fallback string. Stack traces and raw bodies are never shown.
8. No base URL config: same-origin `/api`. A real backend replaces MSW through a dev proxy or deployment, and no component changes.

### `dates.ts` (the only place that parses or formats timestamps)
- `formatDateTime(iso)`, `formatDate(iso)`, `formatTime(iso)` use `Intl.DateTimeFormat(undefined, …)` in the user's local timezone.
- `toStartsAt(date: 'YYYY-MM-DD', time: 'HH:mm'): string` builds a local `Date(y, m-1, d, h, min)` and returns `.toISOString()` (UTC).
- `isFuture(iso, now = Date.now())` is used by validation (A1: equal to now is invalid).
- An invalid ISO string formats as `—`. This never throws during render.

### Request shaping in create
The form maps to `CreateSessionRequest`: trimmed strings; `durationMinutes` and `capacity` as `Number`; `startsAt` from `toStartsAt`; blank optional `description` and `trainerNotes` → `null`.

## 3. Hook Behavior (owner per architecture D2)

| Hook | Trigger | Cancellation | Stale data | Retry |
| --- | --- | --- | --- | --- |
| `useSessions({query,status})` | mount, and param change (query debounced ~250 ms) | abort previous request on param change or unmount | previous `data` stays visible with `isRefreshing`; results of an aborted request are discarded | manual `retry()`; also called after create succeeds |
| `useSessionDetails(id)` | `id` becomes non-null or changes | abort on change, close, or unmount | cleared on id change (never shows another session's data) | manual `retry()` |
| `useCoaches()` | create form opens | abort on unmount | kept for the session lifetime once loaded | manual `retry()` |
| `createSession` (form-local) | submit | not aborted (a POST must not be silently dropped) | n/a | user resubmits manually; the client never retries a POST automatically |

Duplicate-submit guard: the form keeps `pending` state. Submit is disabled and the handler returns early while pending. Nothing more is claimed; there is no idempotency guarantee.

There is no cache. The list re-reads from the server after create, so it is the single source of truth.

## 4. State / Error Matrix

| Region | Condition | Source | User-visible state | Recovery |
| --- | --- | --- | --- | --- |
| List | first load pending | `useSessions` `loading`, no data | loading indicator (`aria-busy`, status text) | — |
| List | 200, `total > 0` | success | rows or cards, result count announced | — |
| List | 200, `total = 0`, no filters active | success + derived `!query && !status` | "No sessions yet" | Create session action |
| List | 200, `total = 0`, filters active | success + derived filters active | "No sessions match …" | Clear filters |
| List | refetch pending | `isRefreshing` | previous results stay, subtle busy indicator | — |
| List | `500 SESSIONS_UNAVAILABLE` / `NETWORK_ERROR` / `INVALID_RESPONSE` | `error` | inline alert with message; filters stay usable | Retry |
| List | `400 INVALID_FILTER` | `error` | inline alert | Clear filters + Retry |
| Details | pending | `loading` | details container with loading text; focus moved into the container | Close |
| Details | 200 | success | full details | Close / Back |
| Details | `404 SESSION_NOT_FOUND` (bad deep link) | `error.status === 404` | "Session not found" | Close (clears `session` param) |
| Details | `500 SESSION_DETAILS_UNAVAILABLE` / network | `error` | inline alert inside details; list unaffected | Retry, Close |
| Coaches | pending | `loading` | coach select disabled with "Loading coaches…" | — |
| Coaches | `500 COACHES_UNAVAILABLE` / network | `error` | alert next to the coach field; **submit disabled** | Retry coaches |
| Coaches | 200 with empty `data` | success | "No coaches available"; submit disabled | — |
| Create | client validation fails | `validation.ts` | field errors (`aria-invalid`, `aria-describedby`); focus moves to the first invalid field; no request sent | Fix fields |
| Create | pending | form `pending` | submit disabled with "Creating…"; inputs keep their values | — |
| Create | `201` | success | announced success (live region) + Open session; Reset filters when the current filters exclude it | Open session / Reset filters |
| Create | `400 VALIDATION_FAILED` with `fieldErrors` | `error.fieldErrors` | known keys → field errors (`startsAt` → date/time); unknown keys → form-level error | Fix fields |
| Create | `500 CREATE_SESSION_FAILED` / network | `error` | form-level alert with message; **all values kept** | Resubmit |

"Current filters exclude it" is derived on the client from the 201 body (`status` vs. the active status; `query` against title, coach name, and location name, case-insensitive). This only decides which affordance to offer. The list contents still come from the server.

## 5. Mock Boundary (`src/mocks/`)

- **`db.ts`**: in-memory store seeded from the fixtures at startup. `rebase(iso, now, referenceNow)` shifts `startsAt`, `createdAt`, `updatedAt`, and `cancellation.cancelledAt` by `now − referenceNow`. `createDb({ now, seed })` is shared by the browser and by tests (tests pass a frozen `now`). Summaries are derived from the details records, so list and details cannot drift apart.
- **`handlers.ts`**: the four contracted endpoints. GET list filters with `query` (case-insensitive substring over title, coach name, location name, and address) and `status` (exact; an unsupported value → `400 INVALID_FILTER`), then computes `meta`. POST validates required fields, enum values, `coachId` ∈ coaches, positive integer duration/capacity, and a parseable ISO `startsAt` → `400 VALIDATION_FAILED` with `fieldErrors`. On success it generates `ses_<random>`, sets `createdAt = updatedAt = now`, uses the coach from the coaches fixture, and returns `201`.
- **`scenario.ts`**: the scenario is read once at startup from the `?scenario=<name>` URL param (an unknown name falls back to `normal`). It exports `getScenario()` and `setScenario()`; tests use `setScenario()`. Handlers apply overrides from `mock-scenarios.json`:
  - `empty`: the store is seeded with zero sessions (same wire response as the fixture body; a later create still appears);
  - `list-error`: GET list → 500;
  - `details-error`: GET `ses_101` → 500, other ids normal;
  - `coaches-error`: GET coaches → 500;
  - `create-error`: POST → 500 after the body has been read;
  - all: latency `defaultLatencyMs` (250) in the browser, 0 in tests.
- `useUrlState` must **preserve unknown params** (`scenario`) when writing `query`, `status`, `session`, or `create`. Otherwise reloading drops the scenario.
- Components and `src/api/` never import from `src/mocks/` or reference scenario names.

## 6. Test Strategy (Option A stack)

- `msw/node` `setupServer(...handlers)` with a db built for a frozen `now` (e.g. the fixture `referenceNow`, so rebased values equal the raw fixtures). `vi.setSystemTime` is set to the same instant, so "future" validation is deterministic.
- `setScenario()` per test. Reset the db and scenario in `afterEach`.
- Behavior assertions from the matrix rows: list populated / loading / empty / no-match / `list-error` retry; search and status send the params (asserted through the rendered results, which come from server-side filtering); create validation, success + discoverability, `create-error` with values preserved.
- Optional unit checks (cheap, pure): `rebase`, `toStartsAt`, `validation.ts`.

## 7. Unresolved / External Confirmation

| # | Item | Owner | Blocking? |
| --- | --- | --- | --- |
| U1 | `fieldErrors` key names (assumed to match request field names) | evaluator / backend owner | No. Unknown keys fall back to the form-level error. |
| U2 | Initial status of a created session (assumed `scheduled`) | evaluator / backend owner | No |
| U3 | Whether search should also match location address (mock matches both name and address; contract says "location") | evaluator | No |

Readiness: the client boundary is defined and implementable. `specs/api-integration.md` is not written because nothing is implemented yet. The remaining specialist is `ui-designer` (Q5).
