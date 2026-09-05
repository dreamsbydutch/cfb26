import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'

export function DetailSheet({
  children,
  close,
  eyebrow,
  title,
}: {
  children: ReactNode
  close: () => void
  eyebrow: string
  title: ReactNode
}) {
  const titleId = useId()
  const panelRef = useRef<HTMLElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const closeHandlerRef = useRef(close)

  useEffect(() => {
    closeHandlerRef.current = close
  }, [close])

  useEffect(() => {
    const previouslyFocused = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeHandlerRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable || focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-stretch sm:justify-end"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Close details"
        onClick={close}
        tabIndex={-1}
        className="absolute inset-0 bg-black/45"
      />
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative max-h-[92dvh] w-full overflow-y-auto border-t-4 border-michigan-maize bg-michigan-cream pb-[env(safe-area-inset-bottom)] shadow-2xl sm:h-full sm:max-h-none sm:max-w-xl sm:border-l-4 sm:border-t-0 sm:pb-0"
      >
        <header className="sticky top-0 z-10 flex min-h-14 items-center justify-between gap-4 border-b border-michigan-maize bg-michigan-blue px-4 py-2 text-white sm:px-5">
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-michigan-maize">
              {eyebrow}
            </p>
            <h2
              id={titleId}
              className="truncate text-lg font-black leading-tight"
            >
              {title}
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={close}
            className="grid h-11 w-11 shrink-0 place-items-center transition hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-michigan-maize"
            aria-label="Close details"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5 fill-none stroke-current"
              strokeWidth="2"
            >
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </header>
        {children}
      </section>
    </div>
  )
}
