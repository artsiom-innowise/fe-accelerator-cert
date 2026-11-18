import { Component, type ReactNode } from 'react'

/** Last-resort boundary for unexpected render errors. Request errors are handled inline per region. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div role="alert" className="alert">
        <p className="alert__title">Something went wrong while showing this page.</p>
        <button type="button" className="button" onClick={() => window.location.reload()}>
          Reload page
        </button>
      </div>
    )
  }
}
