import { setupServer } from 'msw/node'
import { createDb } from './db'
import { createHandlers } from './handlers'
import { setScenario, type ScenarioName } from './scenario'

let db = createDb()

export const server = setupServer(...createHandlers(() => db, 0))

/** Fresh in-memory state for a test, rebased to the given (frozen) instant. */
export function resetMocks({ now, scenario = 'normal' }: { now: number; scenario?: ScenarioName }) {
  setScenario(scenario)
  db = createDb({ now, empty: scenario === 'empty' })
}

export { setScenario }
