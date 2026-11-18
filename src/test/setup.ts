import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest'
import clock from '../../frontend-accelerator-assessment/fixtures/fixture-clock.json'
import { resetMocks, server } from '../mocks/node'

export const FROZEN_NOW = Date.parse(clock.referenceNow)

// Match main.tsx so double-mount effects are exercised.
configure({ reactStrictMode: true })

// jsdom has no HTMLDialogElement modal support; real focus trapping is verified in the browser.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return
    this.removeAttribute('open')
    // Browsers queue the close event as a task; mirror that so late events are exercised.
    setTimeout(() => this.dispatchEvent(new Event('close')))
  }
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

beforeEach(() => {
  // Freeze only Date so debounce and MSW timers stay real; fixtures rebase by zero.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(FROZEN_NOW)
  resetMocks({ now: FROZEN_NOW })
  window.history.replaceState(null, '', '/')
})

afterEach(() => {
  cleanup()
  server.resetHandlers()
  vi.useRealTimers()
})

afterAll(() => server.close())
