import scenarios from '../../frontend-accelerator-assessment/fixtures/mock-scenarios.json'

// Scenario selection is assessment infrastructure: only the mock layer reads it.
export type ScenarioName = keyof typeof scenarios

interface ScenarioEntry {
  description?: string
  request?: string
  status?: number
  body?: unknown
  latencyMs?: number
}

const entries: Record<string, ScenarioEntry> = scenarios
let current: ScenarioName = 'normal'

export function isScenarioName(name: string): name is ScenarioName {
  return Object.hasOwn(scenarios, name)
}

export function scenarioFromSearch(search: string): ScenarioName {
  const name = new URLSearchParams(search).get('scenario') ?? ''
  return isScenarioName(name) ? name : 'normal'
}

export const getScenario = () => current
export function setScenario(name: ScenarioName) {
  current = name
}

export const DEFAULT_LATENCY_MS = scenarios.normal.defaultLatencyMs

/** Error override for `"METHOD /path"` in the active scenario. 2xx entries (e.g. `empty`) are handled by seeding the db instead. */
export function errorOverride(request: string): { status: number; body: unknown } | null {
  const entry = entries[current]
  if (entry.request !== request || entry.status === undefined || entry.status < 400) return null
  return { status: entry.status, body: entry.body }
}

export function latencyOverride(request: string): number | undefined {
  const entry = entries[current]
  return entry.request === request ? entry.latencyMs : undefined
}
