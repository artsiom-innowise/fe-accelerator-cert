import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { startMocks } from './mocks/browser'

// The assessment has no backend: the mock API must be ready before the first request.
const root = document.getElementById('root')!

startMocks().then(
  () => {
    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  },
  (error: unknown) => {
    console.error('Mock API failed to start', error)
    root.textContent = 'The mock API could not start. Open the app on localhost or https in a browser that supports service workers.'
  },
)
