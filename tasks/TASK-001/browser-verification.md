# TASK-001 Browser Verification

Current verdict: **PASS**. This comes from the re-verification run (session `task001-reverify`, see "Re-verification of F1–F4" below), after the F1–F4 fixes.

The first run (session `task001-verify`) returned **FAIL** because of F1 and F2. Its record is kept below, and its screenshots of the populated, no-matches, list-error, details-error, coaches-error and create-error states were replaced by the re-verification captures. It superseded an earlier BLOCKED record (Node 23.11.1); that run was re-done after the runtime switched to Node 24.22.3.

## Setup

| Item | Value |
| --- | --- |
| Date | 2026-11-18 |
| Readiness gate | `node toolchain/bin/doctor.mjs --json`: top-level **DEGRADED**. node PASS (24.22.3), `capability:browser` PASS (agent-browser@0.32.3), `hooks:claude` ACTIVE, `hooks:codex` DEGRADED (PENDING_ACTIVATION; not the assessed runtime). Not BLOCKED. |
| Adapter | `node toolchain/bin/agent-browser.mjs` only |
| Session name | `task001-verify` |
| Discovered URL | `http://localhost:5173/` |
| Server ownership | **Existing user process**, not started by this role: PID 82635 `node /Users/user/Documents/fe-accelerator-cert/node_modules/.bin/vite` (cwd = repo root), dev mode with StrictMode. It was left running. |
| Scenario selection | `?scenario=<name>` at page load (mock boundary) |
| Viewports | 1440×900 desktop; 390×844 mobile |

## Results matrix

| State / flow | Verdict | Evidence |
| --- | --- | --- |
| Populated, 1440×900 | PASS | `evidence/populated-desktop.png`. Snapshot: h1 "Training sessions", "Create session" button, searchbox "Search sessions", combobox "Status", region "Sessions" with 5 column headers and 5 rows (each row has a title link). Count "5 sessions". `scrollWidth` 1440 = `innerWidth`. Status badges carry a symbol and text (● Scheduled, ■ Full, ✕ Cancelled, ✓ Completed). |
| Populated, 390×844 | PASS | `evidence/populated-mobile.png`. Rows reflow to stacked blocks with inline labels. `scrollWidth` 390 = `innerWidth`; no element crosses the viewport edges; every link, button, input and select is ≥ 44px tall. Tab order: Skip link → Create session → search → status → session links. Every stop shows a 2px solid focus outline. |
| Details (keyboard) | PASS | At 390×844, Enter on "Varsity Defense Intensive" opens a `:modal` dialog, URL `?session=ses_102`, focus moves to the dialog `h2`. Shows all list fields, description, trainer notes, "24 booked of 24 places · ■ Full, 0 open", coach email link, and created/updated timestamps (`evidence/details-mobile.png`). Esc closes it, the URL clears, and focus returns to the same link. |
| List context preserved | PASS | With `?query=maya&status=scheduled` (2 rows), clicking a session link → `…&session=ses_101`. Browser Back → `?query=maya&status=scheduled`, same 2 rows. |
| Search / status filter | PASS | `query=maya` and `status=scheduled` reach the API as query params (network log); results are filtered on the server. |
| No matches | PASS with defect F2 | `?query=zzz` → "No sessions match your filters / Search “zzz” / Clear filters" (`evidence/no-matches-desktop.png`). Clear filters → URL cleared, focus on `#session-search`, 5 rows. |
| Empty (`scenario=empty`) | PASS | "No sessions yet / Create the first session to start scheduling. / Create session" (`evidence/empty-desktop.png`). This is distinct from no-matches. |
| Create: validation | PASS | Submitting the empty form sends no POST. 7 controls get `aria-invalid` (title, date, time, capacity, coach, location name, location address). There are 6 inline errors, and the date and time inputs share one error. Focus goes to `#create-title`, and `aria-describedby` points at the error ids. A past start (today 00:05) → "Choose a start time in the future." (`evidence/create-validation-desktop.png`) |
| Create: pending prevention | PASS | Submit clicked 3 times within ~30 ms → exactly **1** `POST /api/sessions` (201). While pending the button reads "Creating…" and is disabled, and Cancel is disabled. |
| Create: success + discoverability | PASS | The dialog closes. Banner: "✓ “Evening Shooting Clinic” created for Tue 1 Dec, 17:00." with Open session; focus goes to the banner. The list refetches to 6 rows and includes the new title (`evidence/create-success-desktop.png`). Open session → `?session=ses_new_1` details. With `status=cancelled` active, the banner adds "It’s hidden by your current filters." and Reset filters (`evidence/create-hidden-by-filter-desktop.png`). Reset filters → URL cleared, focus on search, 7 rows including "Hidden By Filter Camp". |
| Create failure (`scenario=create-error`) | PASS | POST → 500. The form-level alert gets focus: "The session could not be created. Your entries are kept, so you can try again." All 8 entered values are preserved (title, date, time, coach, location name, address, capacity, trainer notes). Submit is re-enabled for retry. (`evidence/create-error-desktop.png`) |
| List error (`scenario=list-error`) | PASS | `role=alert` "Sessions can't be loaded right now." + server message + Retry; the toolbar stays usable (`evidence/list-error-desktop.png`). Retry issues a new request (it returns 500 again, because the scenario is fixed at startup). |
| Details error (`scenario=details-error&session=ses_101`) | PASS | Deep link opens the dialog titled "U14 Shooting Lab" with an in-dialog alert + Retry. The list (5 rows) is unaffected (`evidence/details-error-desktop.png`). Back to sessions → focus returns to the "U14 Shooting Lab" link. `ses_102` details then load normally. |
| Unknown session (`?session=ses_unknown`) | PASS | 404 → "Session not found / It may have been removed…". |
| Coaches error (`scenario=coaches-error&create=1`) | PASS | Alert "Coach choices can't be loaded. You can't create a session until they load." + "Retry loading coaches". The coach select is disabled, submit is disabled, and the visible reason reads "Coach choices are required before you can create a session." (`evidence/coaches-error-desktop.png`) |
| Reduced motion | PASS | With emulated `prefers-reduced-motion: reduce`, the open dialog's `animation-name` is `none`. |

## Defects (first run; all resolved, see re-verification)

| # | Severity | Finding | Requirement |
| --- | --- | --- | --- |
| F1 | Should-fix (a11y) | **Scheduled badge contrast is 4.27:1** (`#087F72` text on the `#E6F2F1` tint, 13px/600), below the 4.5:1 required for normal-size text. Measured: full 4.62, cancelled 5.73, completed 4.88, muted text 5.12, session link 4.90, count 5.50. | AC-8 "sufficient text and control contrast" |
| F2 | Should-fix (state) | **"No sessions yet" flashes after clearing filters from the no-matches state.** Sampled every 80 ms after clicking Clear filters: `No sessions match your filters` → `Updating… / No sessions yet` (0 rows) → `5 sessions`. Cause: `params.status` clears immediately while the debounced query and the stale zero-result data remain. `filtersActive` becomes false, so the empty-state branch renders until the refetch lands (~0.5 s). This shows a wrong "no sessions exist" message and a Create CTA. | AC-4 distinct empty vs no-match states |
| F3 | Minor (visual) | On desktop, status badges stretch to the full Status column width instead of hugging their text. `.sessions-table td > span { display: block }` overrides the badge's `inline-flex`. | Visual hierarchy only |
| F4 | Minor (copy) | Error alerts repeat near-identical text: client title "Sessions can't be loaded right now." + server message "Sessions cannot be loaded right now." The same happens for details, coaches and create. | Copy quality only |

## Re-verification of F1–F4

| Item | Value |
| --- | --- |
| Date | 2026-11-18, after the F1–F4 coder fixes and code-review PASS |
| Readiness gate | Doctor **DEGRADED** (only `hooks:codex` PENDING_ACTIVATION); node 24.22.3 PASS, browser PASS |
| Session | `task001-reverify` |
| URL | `http://localhost:5173/` (same pre-existing user Vite server, PID 82635, picks up changes through HMR; not started or stopped by this role) |

| Defect | Result | Evidence |
| --- | --- | --- |
| F1 badge contrast | **Resolved** | Computed in the browser: scheduled `rgb(6,103,93)` on `rgb(230,242,241)` = **5.90:1** (was 4.27). Full 4.62, cancelled 5.73, completed 4.88. All ≥ 4.5. |
| F2 empty-state flash | **Resolved** | Three runs of "no matches → Clear filters", sampled every 60 ms with a MutationObserver: `flashedEmpty=false` each time. Sequence: `No sessions match your filters` → `Updating… / No sessions match your filters` → `5 sessions`. |
| F3 badge width | **Resolved** | Desktop: badges are `inline-flex`, 57–103px wide in a 257px cell (were full width). Mobile 390×844: also `inline-flex`; `scrollWidth` 390 = `innerWidth`. Updated `evidence/populated-desktop.png` and `evidence/populated-mobile.png`. |
| F4 duplicated alert copy | **Resolved** | list-error: "⚠ Sessions cannot be loaded right now. / Retry". details-error: "⚠ Session details cannot be loaded right now. / Retry". coaches-error: "⚠ Coach choices cannot be loaded right now. You can't create a session until they load. / Retry loading coaches". create-error: "⚠ The session could not be created. Your entries are kept, so you can try again.", with all 7 entered values preserved. Updated screenshots: `list-error-desktop.png`, `details-error-desktop.png`, `coaches-error-desktop.png`, `create-error-desktop.png`, `no-matches-desktop.png`. |

Re-verification console, errors and network: levels were log, info, debug and group only, with **0 error and 0 warning entries**, and **0 page errors**. Non-2xx `/api` responses were only the scenario-expected ones: `GET /api/sessions` 500, `GET /api/sessions/ses_101` 500, `GET /api/coaches` 500, `POST /api/sessions` 500. `close` → `session list` reported "No active sessions". PID 82635 is still running.

Not re-run in this pass (unchanged code paths, covered by the first run): keyboard tab order, details Back/Esc, create validation, pending prevention, success and hidden-by-filter discoverability, empty scenario, unknown session.

## Console, page errors, network (first run)

- **Console:** levels seen were log, info, debug, and startGroupCollapsed/endGroup (MSW request logging). There were **0 `error` and 0 `warning` entries** across the create-error, list-error, empty, details-error, unknown-session, coaches-error and normal re-check passes.
- **Gap:** the console was cleared before the create-error pass, so the very first populated/filter/create pass is covered only by the normal re-check (open, search, details, create validation). That re-check also had no errors.
- **Page errors (`errors`):** none.
- **Failed responses (all expected by scenario):** `POST /api/sessions` 500 (create-error); `GET /api/sessions` 500 ×2 (list-error, including the retry); `GET /api/sessions/ses_101` 500 (details-error); `GET /api/sessions/ses_unknown` 404; `GET /api/coaches` 500 (coaches-error). Every other `/api` request returned 200 or 201. Requests listed without a status were aborted on purpose: StrictMode double effects and superseded filter requests.
- **Navigation:** no unexpected navigation. All requests went to the contracted `/api` paths on the same origin.

## Not verified

- Chrome's repeated-Esc forced close on a dirty create form: it involves the native `confirm()`, which was not driven through the adapter.
- Real touch input and real mobile browsers. Mobile was checked with viewport emulation in Chromium only.
- Screen-reader announcements of live regions (only the DOM roles were checked).
- Firefox and Safari.
- A long-content stress test (very long titles or notes). CSS uses `overflow-wrap: anywhere`, but this was not exercised.
- Mobile screenshots of the error and create states (desktop only, apart from details).

## Session closure

`close` was run for `task001-verify` (first run) and for `task001-reverify` (re-verification). After each, `session list` → "No active sessions". No other session or browser was touched. Dev server PID 82635 is a pre-existing user process and was **not** stopped.
