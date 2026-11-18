# TASK-001 Review Evidence

This file transcribes the actual `code-reviewer` verdicts and findings from `workflow-evidence/prompt-log.jsonl` (L*n* = line number; each is a `Stop` event carrying the role's full response). Nothing here was re-reviewed or re-judged while writing it.

- **Reviewer independence:** the reviewer ran in the same session and model as `coder`. Every review response states "I wrote this code, so this review isn't independent."
- **Review surface:** the working tree (including untracked `src/**`) against the planning checkpoint `9cf16da`. The `dirty` field of each log entry shows the uncommitted file set.

## Round 1: full TASK-001 diff

- Source: L33, 2026-11-18T13:37:15Z
- **Verdict: NEEDS-CHANGES** (2 should-fix, 3 minor)

| # | Severity | Finding | Disposition |
| --- | --- | --- | --- |
| 1 | Should-fix | `src/components/Dialog.tsx:40`: only `cancel` was handled, not the native `close` event. If the browser closes a dialog itself (e.g. Chrome ignores a repeated-Esc `preventDefault`), the URL keeps `create=1`/`session=` and "Create session" can no longer reopen it. | **Resolved**: `coder` (L35) added an `onClose` handler (`onDismiss`) that clears URL state on a browser-initiated close. A regression check closes the dialog natively and reopens it; it failed with the fix disabled and passed with it. |
| 2 | Should-fix | `SessionsWorkspace.tsx:80,103,121`: Reset filters (banner), Clear filters (no-matches) and Clear filters (invalid-filter alert) remove themselves, so keyboard focus is lost (AC-8). | **Resolved** (L35): the shared clear-filters action moves focus to `#session-search`. The test asserts focus after Reset filters. |
| 3 | Minor | `src/main.tsx:8`: a rejected `startMocks()` leaves a blank page. | **Resolved** (L35): the rejection handler logs the error and renders a message. |
| 4 | Minor | `CreateSessionDialog.tsx:86,271`: a server `visibility` field error has no render slot or focus target. Separately, server field errors are cleared by any edit after the first submit. | **Resolved** (L35) for the visibility slot and focus target. **Accepted limitation** for clearing on edit: not reachable from the UI because the form always sends valid values. Impact: a future backend field error disappears on the next edit. |
| 5 | Minor | `src/mocks/db.ts:75`: `crypto.randomUUID()` requires a secure context, so create returns 500 over LAN http. | **Resolved** (L35): ids come from a counter (`ses_new_N`). |

## Round 2: re-review of round-1 fixes

- Source: L37, 2026-11-18T13:42:21Z
- **Verdict: NEEDS-CHANGES** (1 should-fix, marked "likely, needs a browser to confirm")

| # | Severity | Finding | Disposition |
| --- | --- | --- | --- |
| 6 | Should-fix | `Dialog.tsx:29-31,49-51`: under the StrictMode remount, a queued `close` event from the cleanup can arrive after `showModal()` and dismiss a freshly opened dialog in dev. The tests missed it because they render without StrictMode and the jsdom stand-in fires `close` synchronously. | **Resolved** by `coder` (L39): the handler also requires `!ref.current?.open`. `src/test/setup.ts` now enables `reactStrictMode` and dispatches `close` asynchronously. 3 tests failed with the guard removed; 6/6 passed with it. |

Round 1 findings 1–5 were confirmed resolved in this round. Finding 4's clear-on-edit part was confirmed as an accepted limitation.

## Round 3: re-review of the Dialog fix

- Source: L41, 2026-11-18T13:43:22Z
- **Verdict: PASS.** No findings.

## Round 4: re-review of browser-verification fixes F1–F4

- Source: L51, 2026-11-18T14:02:09Z
- **Verdict: PASS.** One optional finding.

F1–F4 came from `browser-verify` run 2 (L47) and were fixed by `coder` (L49):

| ID | Defect | Fix |
| --- | --- | --- |
| F1 | Scheduled badge contrast 4.27:1 | Badge text uses `--primary-hover`, 5.90:1 |
| F2 | "No sessions yet" flashed after clearing filters | Each list result carries the filters that produced it. A MutationObserver regression check failed before the fix and passed after. |
| F3 | Badges stretched across the full column | Table span rules exclude `.badge` |
| F4 | Alerts showed duplicated copy | One message per alert |

This round confirmed all four.

| # | Severity | Finding | Disposition |
| --- | --- | --- | --- |
| 7 | Optional (copy) | `CreateSessionDialog.tsx:93`: on a network failure the create alert says "try again" twice. | **Unresolved** (optional; no change made). |

## Production changes after the last review

Both changes below were made directly in the main session at the developer's request, **without** a `coder` role invocation, and **without** another `code-reviewer` pass.

| Commit | Change | Checks performed |
| --- | --- | --- |
| `6d85645` | Close dialogs on backdrop click (developer-reported issue, L56–L57). | Regression assertion added to test 1; it failed with the fix disabled and passed with it. Ad-hoc browser check in headless Chromium via the project adapter (L57). Pre-commit `verify` PASS (L59). |
| `ff53791` | Visible search label and padded select chevron (developer-reported, L60–L61). | Ad-hoc browser check at both viewports (L61). Pre-commit `verify` PASS (L63). |

The developer's report that Esc did not close the modal could not be reproduced (L57). It remains **unresolved** pending the developer's browser and steps.

## Summary

| Round | Verdict | Open items after the round |
| --- | --- | --- |
| 1 (L33) | NEEDS-CHANGES | 5 → all resolved by L35, with one accepted limitation |
| 2 (L37) | NEEDS-CHANGES | 1 → resolved by L39 |
| 3 (L41) | PASS | 0 |
| 4 (L51) | PASS | 1 optional copy nit, unresolved |
| Post-review commits | not reviewed | Esc report unresolved |
