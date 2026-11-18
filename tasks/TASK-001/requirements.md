# TASK-001 Requirements: Training Sessions Workspace

Source: `frontend-accelerator-assessment/FRONTEND_ASSESSMENT_SPEC.md` (with `API_CONTRACT.md`, `MOCKING_GUIDE.md`, `EVIDENCE_PROTOCOL.md`, `designs/DESIGN_TOKENS.md`, `fixtures/*`).
Application Root: repository root (single Vite + React app; `src/` currently holds only the Vite scaffold).

## Goal

A busy basketball trainer can scan scheduled, full, cancelled, and recently completed sessions, inspect one session, and create a new session from one operational workspace, backed by an MSW implementation of the fixed API contract behind a replaceable client boundary.

## User and Problem

- User: a trainer running several programs across coaches and locations.
- Problem: schedule data is split across calendar, spreadsheets, and chat.
- Outcome: fast scanning, capacity answers, and predictable create actions in one place. Operational density over decoration.

## Acceptance Criteria

### AC-1 Sessions workspace

1. A navigable view lists sessions showing title, type, status, start time (local timezone), duration, coach, location, capacity, and booked count.
2. A search input sends `query` to `GET /api/sessions`; results match title, coach name, or location case-insensitively (filtering happens in the MSW handler, not the client).
3. A single-select status filter (`scheduled | full | cancelled | completed` or none) sends `status`.
4. A "clear filters" action resets search and status in one step and is available whenever any filter is active.
5. Each status is identifiable without color (text label and/or icon in addition to color).
6. Opening a session and returning preserves the current search, status filter, and list scroll/focus context.

### AC-2 Session details

1. Details show all list fields plus description, trainer notes, capacity summary (e.g. booked / capacity, remaining), coach contact (name, email), created and last-updated timestamps (local timezone). Null description/notes render an explicit "none" state.
2. Details are reachable and dismissible by keyboard; focus moves into details on open and returns to the originating control on close.
3. Details are deep-linkable if a router is used (see Open Questions Q1); direct load of a details URL works.
4. Closing details returns to the previous list state (AC-1.6).
5. Cancelled sessions show cancellation info when present (`cancellation.reason`, `cancelledAt`).

### AC-3 Create session

1. Form fields: title, session type, date, start time, duration, coach (from `GET /api/coaches`), location name, location address, capacity, visibility, optional description, optional trainer notes.
2. Client validation (all strings trimmed before checks and submission):
   | Field | Rule |
   | --- | --- |
   | title | 3–80 chars |
   | date + start time | combined local date/time is in the future at submit time |
   | duration | integer 30–240 |
   | capacity | integer 1–100 |
   | coach | required |
   | location name | 2–80 chars |
   | location address | 3–120 chars |
   | trainer notes | ≤ 500 chars |
3. Date + time are converted to a UTC ISO `startsAt` at the client boundary.
4. Submit is disabled / ignored while a request is pending (no duplicate POST); no client idempotency key is invented.
5. Field errors render adjacent to their control and are programmatically associated (`aria-describedby` / `aria-invalid`). Server `400 VALIDATION_FAILED` `fieldErrors` map onto the same fields; a form-level error summarizes non-field failures.
6. On `500 CREATE_SESSION_FAILED` (or network failure) all entered values remain and the user can retry.
7. On `201` success is explicitly announced and visible.
8. The created session is discoverable: it appears in the list when current filters include it; when active filters would hide it, the success message offers "Open session" and/or "Reset filters".
9. When `GET /api/coaches` fails, the form shows a coaches error with retry and cannot submit (no fake coach selection).

### AC-4 Observable UI states

Each is distinct, user-understandable, and testable: initial loading; populated; no sessions exist (`empty` scenario); filters produce no matches (with clear-filters recovery); list request fails (with retry); details request fails (with retry/close); coaches request fails (with retry); create pending, success, validation failure, server failure.

### AC-5 Mock boundary (MSW 2.14.6)

1. Handlers implement `GET /api/sessions`, `GET /api/sessions/:sessionId`, `GET /api/coaches`, `POST /api/sessions` exactly per `API_CONTRACT.md` (paths, shapes, error codes, `meta.total` after filtering, `page: 1`, `pageSize: 10`).
2. `POST` validates required fields, `coachId` existence, positive duration/capacity, enum values, ISO timestamp; returns `400 VALIDATION_FAILED` with `fieldErrors`; on success returns `201` `SessionDetails` with generated id and timestamps, the coach from `coaches.json`, and the session becomes visible via later list and details reads (in-memory state).
3. Required scenarios `normal`, `empty`, `list-error`, `details-error`, `coaches-error`, `create-error` are selectable at the mock boundary only; presentation components never reference scenario names.
4. Fixture timestamps (`startsAt`, `createdAt`, `updatedAt`, `cancelledAt`) are rebased at mock startup by `now - referenceNow`; tests freeze the clock and apply the same transformation.
5. Application code and API client never import fixture JSON.
6. App runs with no network access and no real backend.

### AC-6 API client and data ownership

1. All transport lives in one client module; components call typed functions, not `fetch`.
2. Server/request state has one deliberate owner; no duplicated sources of truth.
3. Dates are parsed/normalized at a clear boundary and displayed in the user's local timezone.
4. No new endpoints or response-shape changes; any proposal is recorded separately in task docs.

### AC-7 Responsive

1. Usable at 1440×900 (comparison-friendly table) and 390×844 (scan-friendly alternative, e.g. stacked rows/cards).
2. No unreachable content/actions, no overlap, no horizontal page scroll at either width.

### AC-8 Accessibility

Full keyboard operation; visible focus; semantic controls and labels; meaningful page/section headings; associated validation errors; live-region announcements for status and mutation feedback; non-color status; sufficient contrast (DESIGN_TOKENS palette); `prefers-reduced-motion` respected for any motion.

### AC-9 Tests (owned by `coder`)

4–6 focused behavior-level tests using the project test stack covering: search and status filtering; create validation and successful submission; create server failure preserving input; initial loading; no sessions and no matches; one list or details error.

### AC-10 Delivery

1. App starts with a documented npm command.
2. No uncaught console errors in primary flows.
3. Evidence per `EVIDENCE_PROTOCOL.md` (requirements → specialist decisions → plan before `coder`; workflow log; review; verification; browser matrix; final report).

## Constraints

- React 19, TypeScript ≥ 5.9, Vite ≥ 7, npm, `msw@2.14.6` (already installed: React 19.3, TS 6.0, Vite 8.3, MSW 2.14.6).
- Every new dependency needs a recorded reason and trade-off. Do not add a data library merely because React rules mention patterns.
- Do not modify `frontend-accelerator-assessment/` or unrelated source/config.
- No secrets, real personal data, analytics, or production credentials. No i18n.
- Visual direction: `designs/DESIGN_TOKENS.md` palette/spacing; reference SVG conveys hierarchy and density only. No hero, gradients, or nested cards.

## Non-Goals

Backend; auth/registration; payments; email/notifications; drag-and-drop calendar; recurring sessions; attendee management; org admin; deployment. Optional extensions (type filter, URL sync, pagination, cancellation, read-only permission, background refresh, tablet checks, `create-conflict` and other optional scenarios, optimistic updates, extra tests, calendar/saved views) are out of scope unless separately chosen; they do not compensate for required behavior.

## Facts (from inputs)

- Fixtures: 5 sessions — `ses_101` scheduled, `ses_102` full, `ses_103` scheduled, `ses_104` cancelled, `ses_105` completed (past). Each has a details fixture.
- `referenceNow` = `2026-07-27T12:00:00Z`.
- `details-error` targets `ses_101` only; other details succeed in that scenario.
- `src/` contains only the Vite scaffold; no router, no test runner, no testing library is installed.

## Assumptions (to confirm in downstream roles; not living-spec truth)

- A1. "Future start" is evaluated against the current instant at submit time; equal-to-now is invalid.
- A2. Status filter values map 1:1 to `SessionStatus`; "full" is a server-provided status, not derived client-side.
- A3. Search is submitted as the user types with a short debounce or on explicit submit — either satisfies the spec; UX owner decides.
- A4. Default selected `visibility` and `type` may be preset (e.g. `public`, `training`) as long as the user can change them.
- A5. Scenario selection mechanism (e.g. `?scenario=` query param or env var read only in the mock bootstrap) is acceptable as long as it stays at the mock boundary.

## Open Questions

| # | Question | Owner |
| --- | --- | --- |
| Q1 | Routing: add a router dependency (enables deep-linkable details and URL-preserved list state) vs. no router with in-app state (details as modal/drawer; deep-link optional "when the router permits"). | `architect` |
| Q2 | Server-state owner: plain hooks + context/reducer vs. a data library (needs justification). Cache invalidation after create. | `architect` |
| Q3 | Test stack: none installed. Choose runner (e.g. Vitest) + DOM testing library + MSW node setup; record dependency trade-offs. | `architect` |
| Q4 | Client module shape, error normalization (`ApiError` → UI error), date normalization boundary, `fieldErrors` mapping, scenario selection mechanism. | `api-integration` |
| Q5 | Details presentation (route vs. drawer vs. modal), create form placement (route vs. dialog), mobile list representation, status indicator design, success/discoverability affordance. | `ui-designer` |

## Decisions Requiring Human Authority

- Any additional dependency (router, test tooling, data library) — developer approves the recorded reason.
- Any proposed API contract change — evaluator approval required (none proposed).
- Which optional extensions, if any, to include.

## Readiness

Product requirements are complete and unambiguous enough to proceed. Implementation is **not** ready for `writing-plans` until Q1–Q3 (`architect`), Q4 (`api-integration`), and Q5 (`ui-designer`) are decided and recorded in `architecture.md`, `api-integration.md`, and `ui-design.md`.
