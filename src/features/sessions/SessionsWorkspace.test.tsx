import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from '../../App'
import { resetMocks, setScenario } from '../../mocks/node'
import { FROZEN_NOW } from '../../test/setup'

const rowTitles = () =>
  within(screen.getByRole('table'))
    .getAllByRole('link')
    .map((link) => link.textContent)

async function renderLoaded() {
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('table')
  return user
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>, title: string) {
  const dialog = await screen.findByRole('dialog', { name: 'Create session' })
  const form = within(dialog)
  await waitFor(() => expect(form.getByLabelText(/^Coach/)).toBeEnabled())
  await user.type(form.getByLabelText(/^Title/), title)
  await user.type(form.getByLabelText('Date'), '2026-08-20')
  await user.type(form.getByLabelText('Start time'), '17:00')
  await user.selectOptions(form.getByLabelText(/^Coach/), 'Maya Brooks')
  await user.type(form.getByLabelText(/^Location name/), 'North Court')
  await user.type(form.getByLabelText(/^Location address/), '12 Court Street')
  await user.type(form.getByLabelText(/^Capacity/), '12')
  return form
}

describe('Sessions workspace', () => {
  it('loads sessions, then searches and filters by status through the API', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByText('Loading sessions…')).toBeInTheDocument()

    await screen.findByRole('table')
    expect(rowTitles()).toHaveLength(5)
    expect(screen.getByText('5 sessions')).toBeInTheDocument()

    await user.type(screen.getByRole('searchbox', { name: 'Search sessions' }), 'maya')
    await waitFor(() => expect(rowTitles()).toEqual(['U14 Shooting Lab', 'Private Footwork Review']))

    await user.clear(screen.getByRole('searchbox', { name: 'Search sessions' }))
    await user.selectOptions(screen.getByLabelText('Status'), 'Cancelled')
    await waitFor(() => expect(rowTitles()).toEqual(['Weekend Ball Handling']))
    expect(screen.getByText('1 session')).toBeInTheDocument()
  })

  it('distinguishes no matches from no sessions, with recovery actions', async () => {
    const user = await renderLoaded()
    await user.type(screen.getByRole('searchbox', { name: 'Search sessions' }), 'zzz')
    expect(await screen.findByRole('heading', { name: 'No sessions match your filters' })).toBeInTheDocument()

    // While the cleared list reloads, the stale zero result must never read as "no sessions exist".
    let flashedEmpty = false
    const observer = new MutationObserver(() => {
      flashedEmpty ||= document.body.textContent?.includes('No sessions yet') ?? false
    })
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    // Toolbar and empty-state both offer Clear filters; use the toolbar one.
    await user.click(screen.getAllByRole('button', { name: 'Clear filters' })[0])
    await waitFor(() => expect(rowTitles()).toHaveLength(5))
    observer.disconnect()
    expect(flashedEmpty).toBe(false)
    expect(screen.getByRole('searchbox', { name: 'Search sessions' })).toHaveFocus()

    cleanup()
    resetMocks({ now: FROZEN_NOW, scenario: 'empty' })
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'No sessions yet' })).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows a list error and recovers on retry', async () => {
    setScenario('list-error')
    const user = userEvent.setup()
    render(<App />)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Sessions cannot be loaded right now.')
    expect(alert).not.toHaveTextContent("Sessions can't be loaded right now.")

    setScenario('normal')
    await user.click(within(alert).getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(rowTitles()).toHaveLength(5))
  })

  it('validates the create form without sending a request', async () => {
    const user = await renderLoaded()
    await user.click(screen.getByRole('button', { name: 'Create session' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Create session' }))
    await waitFor(() => expect(dialog.getByLabelText(/^Coach/)).toBeEnabled())

    await user.type(dialog.getByLabelText(/^Title/), 'ab')
    await user.click(dialog.getByRole('button', { name: 'Create session' }))

    const title = dialog.getByLabelText(/^Title/)
    expect(title).toHaveAttribute('aria-invalid', 'true')
    expect(title).toHaveAccessibleDescription(/Use 3 to 80 characters/)
    expect(title).toHaveFocus()
    expect(dialog.getByLabelText('Date')).toHaveAccessibleDescription('Choose a date and start time.')
    expect(dialog.getByLabelText(/^Coach/)).toHaveAttribute('aria-invalid', 'true')
    expect(dialog.getByLabelText(/^Capacity/)).toHaveAttribute('aria-invalid', 'true')

    // Fixing a field clears its error after the first submit.
    await user.type(title, 'c')
    expect(title).not.toHaveAttribute('aria-invalid')
    expect(rowTitles()).toHaveLength(5)

    // A browser-initiated close (e.g. repeated Esc) must not leave the dialog stuck closed in app state.
    const createDialog = screen.getByRole('dialog', { name: 'Create session' }) as HTMLDialogElement
    createDialog.close()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Create session' }))
    expect(await screen.findByRole('dialog', { name: 'Create session' })).toBeInTheDocument()
  })

  it('creates a session and offers to reveal it when filters hide it', async () => {
    const user = await renderLoaded()
    await user.selectOptions(screen.getByLabelText('Status'), 'Cancelled')
    await waitFor(() => expect(rowTitles()).toEqual(['Weekend Ball Handling']))

    await user.click(screen.getByRole('button', { name: 'Create session' }))
    const form = await fillValidForm(user, 'U16 Shooting')
    await user.click(form.getByRole('button', { name: 'Create session' }))

    const banner = await screen.findByText(/“U16 Shooting” created/)
    expect(banner).toHaveTextContent('hidden by your current filters')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reset filters' }))
    expect(screen.getByRole('searchbox', { name: 'Search sessions' })).toHaveFocus()
    await waitFor(() => expect(rowTitles()).toContain('U16 Shooting'))
    expect(rowTitles()).toHaveLength(6)
    expect(screen.getByRole('button', { name: 'Open session' })).toBeInTheDocument()
  })

  it('keeps entered values when the server fails to create', async () => {
    setScenario('create-error')
    const user = await renderLoaded()
    await user.click(screen.getByRole('button', { name: 'Create session' }))
    const form = await fillValidForm(user, 'Keep Me')
    await user.click(form.getByRole('button', { name: 'Create session' }))

    const alert = await form.findByRole('alert')
    expect(alert).toHaveTextContent('Your entries are kept')
    expect(alert).toHaveTextContent('The session could not be created.')
    expect(form.getByLabelText(/^Title/)).toHaveValue('Keep Me')
    expect(form.getByLabelText(/^Location name/)).toHaveValue('North Court')
    expect(form.getByLabelText(/^Capacity/)).toHaveValue(12)
    expect(form.getByRole('button', { name: 'Create session' })).toBeEnabled()
  })
})
