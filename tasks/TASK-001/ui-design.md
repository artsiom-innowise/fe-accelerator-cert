# TASK-001 UI Design

Inputs: `requirements.md` (Q5), `architecture.md` (D1 URL state, D5 failure containment), `api-integration.md` (state/error matrix), `designs/DESIGN_TOKENS.md`, `designs/sessions-dashboard-reference.svg`, `rulesets/common/ui-designer/*` (product context + pinned Web Interface Guidelines).

Visual direction: **confirmed by the assessment inputs**, so no options round is needed. Use the DESIGN_TOKENS palette, type scale, spacing, and 6px radius. The tone is operational and calm. The reference SVG gives hierarchy and density, not pixels. No existing design system or components exist (Vite scaffold), so everything below is new and kept minimal. Remove the scaffold's `App.css`/`index.css` demo styles in favour of token CSS custom properties.

## 1. Flow

```
Workspace (list) ──click title / Enter──▶ Details dialog (?session=id) ──Esc / Close / Back──▶ Workspace, same filters, focus on the originating title
       │
       └──Create session──▶ Create dialog (?create=1) ──201──▶ Workspace + success banner [Open session] [Reset filters if hidden]
                                   │ 400/500 → stays open, values kept
                                   └ Cancel / Esc / Back → confirm discard if dirty
```

Details and create are overlays on top of the list, so the list never unmounts and its context (filters, scroll) is kept by construction.

## 2. Layout Structure

### Page shell
- Skip link "Skip to sessions" → `<main>`.
- Slim `<header>`: product mark "Courtside Operations" as text. **The reference sidebar items (Coaches, Locations, Programs) are omitted** because they are non-goals and dead links would be unreachable promises.
- `<main>`: max-width none, padding 24px (desktop) / 16px (mobile), `canvas` background, one `surface` work area (no nested cards).

### Workspace (in order)
1. **Page heading row:** `h1` "Training sessions" (24/32/700) with supporting line "Find scheduled work, review capacity, and create sessions." (13/18 muted). Primary button "Create session" is right-aligned on desktop and sits below the heading at full width on mobile.
2. **Toolbar** (`role="search"`, labelled "Filter sessions"):
   - search `<input type="search">`, label "Search sessions" (visually hidden is fine only if the placeholder is present), placeholder "Search title, coach, or location…";
   - status `<select>` with visible label "Status", options: All statuses, Scheduled, Full, Cancelled, Completed;
   - "Clear filters" secondary button, **rendered only while a filter is active** (disabling would leave a focusable dead control);
   - result count text "5 sessions" (13px muted). It lives in the shared polite live region (see §5).
   - The type filter is omitted (optional extension).
3. **Results region** `<section aria-labelledby>` with visually hidden `h2` "Sessions". It contains the table or a state block (§4).

### Table (desktop, ≥ 768px)
Semantic `<table>` with `<caption class="visually-hidden">`. Columns follow the reference, extended to meet AC-1.1:

| Column | Content |
| --- | --- |
| Session | title as `<a href="?session=ses_101&…">` (600 weight), second line muted: "Training · North Court" (type label · location name) |
| Start | "Mon, Aug 3, 18:00" (Intl, local) over muted "90 min" |
| Coach | name |
| Capacity | "14 / 18" (`tabular-nums`), muted "booked". Visually hidden full text: "14 booked of 18" |
| Status | status badge (§3) |

Rows have a hover tint (`surface-muted`), but **the link is the action**, not the whole row: no click handlers on `<tr>`. Row height comes from the content (about 56px) with dividers in `border`. Long titles wrap; they are never truncated.

### Mobile (< 768px): same DOM, CSS reflow
- The table reflows to a stacked list. Each `<tr>` becomes a block with a bottom divider. `<thead>` is visually hidden. Each cell shows its column name as a muted inline label from `data-label` (for example "Coach Maya Brooks").
- Explicit `role="table|rowgroup|row|columnheader|cell"` attributes keep table semantics after `display:block` resets them.
- Order inside a row: title link + status badge on the first line, then start · duration, coach, location, capacity.
- The title link's hit area is at least 44px tall.
- No horizontal scroll. Every text container uses `min-width: 0` and `overflow-wrap: anywhere`.

### Details dialog
- Native `<dialog>` opened with `showModal()`. This gives a focus trap, an inert background, and Esc to close.
- Desktop: right-side panel, 480px wide, full height, scrolls internally (`overscroll-behavior: contain`). Mobile: full screen.
- Structure (from the reference panel):
  - header: muted eyebrow "Session details", `h2` title, status badge, Close button (`aria-label="Close session details"`);
  - `<dl>` groups in order: Start (long form "Monday, Aug 3 at 18:00" + end time "until 19:30"), Duration, Type, Visibility, Location (name + address), Coach (name + `mailto:` email link), Capacity ("14 booked of 18 places · 4 open"; when full, "Full — 0 open" in `warning` with a symbol), Description, Trainer notes;
  - cancelled sessions add a **Cancellation** group (reason or "No reason recorded", cancelled time) placed first, below the header;
  - footer muted line: "Created … · Last updated …";
  - null description or notes show "None" in muted text, so an empty `dd` never appears.
- Footer action "Back to sessions" (same as Close).

### Create dialog
- Same dialog shell. Desktop: right-side panel 560px wide. Mobile: full screen. Title `h2` "Create session".
- Form, single column on mobile. On desktop, these pairs share a row: Date | Start time, Duration | Capacity, Location name | Location address.

| Field | Control | Notes |
| --- | --- | --- |
| Title | text, `maxlength` not set (validation message instead, so paste is never silently cut) | required |
| Session type | `<select>` Training / Camp / Private, default Training | |
| Date | `type="date"`, `min`=today local | |
| Start time | `type="time"` | one error slot under the pair ("Choose a start time in the future") |
| Duration (minutes) | `type="number" inputmode="numeric" min=30 max=240 step=15`, default 60 | hint "30–240" |
| Coach | `<select>` from coaches; first option "Choose a coach" (empty value) | the loading, error, and empty states are in §4 |
| Location name | text | |
| Location address | text, `autocomplete="street-address"` | |
| Capacity | number, `min=1 max=100`, no default | hint "1–100" |
| Visibility | radio group (`fieldset`/`legend`): Public (default) / Invite only | |
| Description | `<textarea>` optional | |
| Trainer notes | `<textarea>` optional, live counter "0 / 500" (`aria-describedby`) | the counter turns `danger` with an error over 500 |

- Every input has a visible `<label>`. Required fields are marked "(required)" in text, not with an asterisk alone.
- Sticky footer actions: secondary "Cancel", primary "Create session". On mobile they stay visible above the on-screen keyboard where the browser allows (sticky inside the dialog scroll container).

## 3. Status Indicator

Badge = symbol (`aria-hidden`) + text label, 13px, 6px radius, tinted background and border with token text color. The text alone carries meaning.

| Status | Symbol | Text | Color token |
| --- | --- | --- | --- |
| scheduled | ● | Scheduled | `primary` |
| full | ■ | Full | `warning` |
| cancelled | ✕ | Cancelled | `danger` |
| completed | ✓ | Completed | `text-muted` |

The badge text must meet 4.5:1 on its tint. Use solid token text on a ~10% tint, and verify during browser checks.

## 4. State Matrix (UI rendering of `api-integration.md` §4)

| Region | State | Rendering | Focus / announcement |
| --- | --- | --- | --- |
| List | initial loading | table header plus a single row "Loading sessions…"; results region `aria-busy="true"`; toolbar usable | live region: none until resolved |
| List | populated | table / stacked rows | live: "5 sessions" (also after each filter change) |
| List | refreshing | previous rows stay, `aria-busy="true"`, count text "Updating…" | live: new count when done |
| List | no sessions exist | block in the results region: `h3` "No sessions yet", text "Create the first session to start scheduling.", primary "Create session" | live: "No sessions" |
| List | no matches | `h3` "No sessions match your filters", echo of filters ("Search “abc” · Status: Full"), button "Clear filters" | live: "No matching sessions" |
| List | error | `role="alert"` block: "Sessions can't be loaded right now." + server message when different + "Retry" button; toolbar still usable | alert announces |
| Details | loading | dialog opens immediately with the title from the list row (if known) and "Loading details…" | focus → dialog `h2` (`tabindex="-1"`) |
| Details | error (500/network) | in-dialog `role="alert"`: message + "Retry" + "Back to sessions" | alert announces |
| Details | not found (404) | in-dialog: `h2` "Session not found", text "It may have been removed. Return to the list.", "Back to sessions" | focus → `h2` |
| Coaches | loading | coach select disabled, option "Loading coaches…" | — |
| Coaches | error | under the coach field: `role="alert"` "Coach choices can't be loaded. You can't create a session until they load." + "Retry"; submit button **disabled** with a visible reason under the footer | alert |
| Coaches | empty | select disabled, "No coaches available"; submit disabled | — |
| Create | validation fail (client or 400) | inline error under each field (`danger`, ⚠ symbol + text); `aria-invalid="true"`, `aria-describedby` → error id; form-level summary at the top for 400 keys that don't map to a field | focus → first invalid field |
| Create | pending | primary "Creating…" with stable width, `disabled`; fields stay editable (values kept); Cancel disabled to avoid an ambiguous outcome | live: "Creating session…" |
| Create | server failure (500/network) | form-level `role="alert"` at the top of the form: "The session could not be created. Your entries are kept — try again." + server message; all values kept | focus → alert (`tabindex="-1"`) |
| Create | success | dialog closes. Success banner (`role="status"`, `success` token, ✓) at the top of the results region: "“U16 Shooting” created for Tue, Aug 11, 17:00." Actions: **Open session** (always); when current filters hide it, also the text "It's hidden by your current filters." + **Reset filters**; Dismiss (×, `aria-label="Dismiss"`) | focus → banner (`tabindex="-1"`); announced politely |

The banner persists until dismissed, until another create, or until filters change after a reset. It is not auto-dismissed on a timer (the user might miss it).

## 5. Interaction Rules

- **Live regions:** one visually hidden `aria-live="polite"` region in the workspace for the count and mutation status. Errors use `role="alert"` at their region. No toasts.
- **Search:** filters as you type (debounce ~250 ms, per api-integration). Enter does nothing extra. The input `type="search"` gives native clear (×) and Esc-to-clear.
- **Status select:** applies on change.
- **Clear filters:** resets both and moves focus to the search input.
- **Opening details:** the title is a real link (Cmd/Ctrl-click opens a new tab through the deep link). A plain click is intercepted → `pushState` `?session=`.
- **Closing details:** Esc, Close, "Back to sessions", or browser Back all remove `session` from the URL. Focus returns to the title link that opened it. On a direct deep-link load, focus returns to `h1`.
- **Create dialog:** opened by "Create session" (both buttons) → `?create=1`. Focus → Title input. Close with dirty fields → native `confirm("Discard this new session?")`. `shortcut:` native confirm is accessible but unstyled; replace it with a custom confirm dialog if it becomes a pattern. Closing returns focus to the opening button.
- **Validation timing:** validate everything on submit. After the first submit, re-validate a field on blur and on change, so errors clear as the user fixes them. Never show errors on a pristine field.
- **Disabled vs hidden:** do not hide submit when coaches fail. Disable it with a visible reason, so the user understands why.
- **Hover** only adds tint. Every action is a visible button or link.
- **Motion:** dialog slide-in 150ms `transform`/`opacity` only. Under `prefers-reduced-motion: reduce`, no animation. Never `transition: all`.

## 6. Responsive Behavior

| Width | Behavior |
| --- | --- |
| ≥ 1024 (target 1440×900) | page padding 24px; toolbar on one row (search flex 1 with max 420px, status 200px, Clear, count right-aligned); table; details/create dialogs as right panels over the dimmed list |
| 768–1023 | same, toolbar wraps to two rows when needed |
| < 768 (target 390×844) | padding 16px; Create button full-width under the heading; search full width, status + Clear on the next row; stacked rows; dialogs full-screen; 44px minimum touch targets; form single column with sticky footer actions |

Checks for browser-verify: `document.documentElement.scrollWidth <= innerWidth` at 1440 and 390; every action reachable by Tab and by tap.

## 7. Accessibility Requirements (summary)

- Landmarks: `header`, `main`, `role="search"`. Headings: `h1` page, `h2` sessions (hidden) / dialog titles, `h3` state blocks.
- Visible focus: 2px `focus` outline with 2px offset on `:focus-visible`, for every control including links and badges inside links.
- Contrast: body `text` on `surface` passes; check muted 13px text (`#5F6B6F` on `#FFFFFF` ≈ 5.3:1, passes) and the badge tints.
- Errors are programmatically associated. Status is never color-only. Dates use `Intl`. `<html lang="en">`. Zoom is not disabled.
- Native dialog: label it with `aria-labelledby` → `h2`. Return focus on close (see §5).

## 8. Reuse Candidates (keep to what is used at least twice)

- `StatusBadge` (table, details, banner text where needed).
- `Dialog` shell (details + create): native `<dialog>`, header with close, scroll body, footer.
- `Field` wrapper (label + control + hint + error id wiring), used by every form field.
- `InlineAlert` (list, details, coaches, and create errors): message + optional Retry.
- Formatters come from `src/api/dates.ts`; no UI duplicates.

Nothing more. No button or input component library.

## 9. Unresolved / Notes

| # | Item | Owner | Blocking? |
| --- | --- | --- | --- |
| N1 | Cancel stays disabled while create is pending (avoids an ambiguous outcome). It could instead allow close with the request continuing. | developer | No |
| N2 | The reference shows a type filter; it is an optional extension and omitted. | developer | No |

Readiness: implementation-ready. All required specialist decisions (architecture, API integration, UI) are recorded. `specs/ui-design.md` is not written because nothing is implemented yet.
