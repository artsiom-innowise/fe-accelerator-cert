# Training Sessions Workspace

Frontend-only workspace for a basketball training business: scan, filter and inspect scheduled sessions, and create new ones. The API (`/api/*`, see `frontend-accelerator-assessment/API_CONTRACT.md`) is served by Mock Service Worker in the browser; there is no backend.

## Commands

```bash
npm install        # once
npm run dev        # start the app (URL printed by Vite)
npm test           # behavior tests (Vitest + Testing Library + MSW node)
npm run build      # typecheck and production build
npm run lint
```

The app works offline once dependencies are installed.

## Mock scenarios

Append `?scenario=<name>` to the app URL to select a deterministic mock scenario at startup:

| Scenario | Effect |
| --- | --- |
| `normal` (default) | fixture sessions, details and coaches |
| `empty` | no sessions exist |
| `list-error` | `GET /api/sessions` returns 500 |
| `details-error` | `GET /api/sessions/ses_101` returns 500 |
| `coaches-error` | `GET /api/coaches` returns 500 |
| `create-error` | `POST /api/sessions` returns 500 |

Fixture timestamps are rebased to the current time at mock startup. Created sessions live in memory until reload.

## Structure

- `src/api/`: typed client, contract types, date parsing and formatting
- `src/features/sessions/`: workspace, details and create dialogs, data hooks, validation
- `src/components/`: shared dialog, field, alert and status badge
- `src/lib/useUrlState.ts`: URL search params (`query`, `status`, `session`, `create`) as the single owner of view state
- `src/mocks/`: MSW handlers, in-memory db, scenario selection (the only code that reads fixtures)

Task decisions and evidence: `tasks/TASK-001/`.
