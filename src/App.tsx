import { ErrorBoundary } from './components/ErrorBoundary'
import { SessionsWorkspace } from './features/sessions/SessionsWorkspace'

export default function App() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to sessions
      </a>
      <header className="app-header">
        <span className="brand">Courtside Operations</span>
      </header>
      <main id="main" tabIndex={-1}>
        <ErrorBoundary>
          <SessionsWorkspace />
        </ErrorBoundary>
      </main>
    </>
  )
}
