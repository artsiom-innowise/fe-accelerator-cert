import { useEffect, useEffectEvent, useRef, type ReactNode } from 'react'

interface DialogProps {
  titleId: string
  /** Called for Esc and close controls; the parent decides whether to unmount. */
  onClose: () => void
  /** Called when the browser closed the dialog itself (e.g. Chrome ignores a repeated Esc preventDefault). Defaults to onClose. */
  onDismiss?: () => void
  /** Element to focus on close; falls back to the opener, then the page heading. */
  returnFocus?: () => HTMLElement | null
  size?: 'narrow' | 'wide'
  children: ReactNode
}

/** Native modal dialog: focus trap, inert background and Esc come from the platform. */
export function Dialog({ titleId, onClose, onDismiss = onClose, returnFocus, size = 'narrow', children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const unmountingRef = useRef(false)
  const pressedBackdropRef = useRef(false)
  const getReturnTarget = useEffectEvent(() => returnFocus?.() ?? null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    unmountingRef.current = false
    dialog.showModal()
    const initial = dialog.querySelector<HTMLElement>('[data-initial-focus]') ?? document.getElementById(titleId)
    initial?.focus()
    return () => {
      unmountingRef.current = true
      dialog.close()
      const target =
        getReturnTarget() ??
        (opener && opener !== document.body && opener.isConnected ? opener : null) ??
        document.getElementById('page-title')
      target?.focus()
    }
  }, [titleId])

  return (
    <dialog
      ref={ref}
      className={`dialog dialog--${size}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      // Content fills the dialog box, so a target of the dialog itself means the backdrop.
      // Require press and release there so a text selection dragged outside does not close it.
      onMouseDown={(event) => {
        pressedBackdropRef.current = event.target === event.currentTarget
      }}
      onClick={(event) => {
        if (pressedBackdropRef.current && event.target === event.currentTarget) onClose()
        pressedBackdropRef.current = false
      }}
      onClose={() => {
        // A native close the app did not request: sync app state so the dialog can reopen.
        // `open` guards against a late close event from a StrictMode remount arriving after showModal().
        if (!unmountingRef.current && !ref.current?.open) onDismiss()
      }}
    >
      {children}
    </dialog>
  )
}
