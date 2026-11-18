import { setupWorker } from 'msw/browser'
import { createDb } from './db'
import { createHandlers } from './handlers'
import { DEFAULT_LATENCY_MS, scenarioFromSearch, setScenario } from './scenario'

/** Starts the mock API. A real backend replaces this single call in main.tsx. */
export async function startMocks() {
  const scenario = scenarioFromSearch(window.location.search)
  setScenario(scenario)
  const db = createDb({ now: Date.now(), empty: scenario === 'empty' })
  const worker = setupWorker(...createHandlers(() => db, DEFAULT_LATENCY_MS))
  await worker.start({ onUnhandledRequest: 'bypass' })
}
