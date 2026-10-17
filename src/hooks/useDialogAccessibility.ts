import { useEffect, useRef, type RefObject } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/** Keep keyboard focus inside an open modal and restore it to the opener on close. */
export function useDialogAccessibility(
  dialogRef: RefObject<HTMLElement | null>,
  getInitialFocus: () => HTMLElement | null,
  onClose: () => void,
  active = true,
  canClose: () => boolean = () => true,
) {
  const getInitialFocusRef = useRef(getInitialFocus)
  const onCloseRef = useRef(onClose)
  const canCloseRef = useRef(canClose)
  getInitialFocusRef.current = getInitialFocus
  onCloseRef.current = onClose
  canCloseRef.current = canClose

  useEffect(() => {
    if (!active) return
    const dialog = dialogRef.current
    if (!dialog) return

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const initialFocus = getInitialFocusRef.current() ?? dialog
    initialFocus.focus({ preventScroll: true })

    const getFocusableElements = () => Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter(
      (element) => !element.closest('[hidden], [aria-hidden="true"]'),
    )

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!canCloseRef.current()) return
        event.preventDefault()
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const focusableElements = getFocusableElements()
      const first = focusableElements[0]
      const last = focusableElements.at(-1)
      const current = document.activeElement

      if (!first || !last) {
        event.preventDefault()
        dialog.focus()
      } else if (event.shiftKey && (current === first || current === dialog || !dialog.contains(current))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (current === last || current === dialog || !dialog.contains(current))) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (previouslyFocused?.isConnected && !previouslyFocused.hasAttribute('disabled')) {
        previouslyFocused.focus({ preventScroll: true })
      }
    }
  }, [active, dialogRef])
}

/** Implements the arrow/Home/End/Escape keys for a simple ARIA menu. */
export function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLElement>, onClose: () => void) {
  const items = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled]):not([aria-disabled="true"])'),
  )
  if (items.length === 0) return

  const currentIndex = items.indexOf(document.activeElement as HTMLElement)
  let nextIndex: number | null = null
  switch (event.key) {
    case 'ArrowDown':
      nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length
      break
    case 'ArrowUp':
      nextIndex = currentIndex < 0 ? items.length - 1 : (currentIndex - 1 + items.length) % items.length
      break
    case 'Home':
      nextIndex = 0
      break
    case 'End':
      nextIndex = items.length - 1
      break
    case 'Escape':
      event.preventDefault()
      event.stopPropagation()
      onClose()
      return
    default:
      return
  }

  event.preventDefault()
  items[nextIndex]?.focus()
}
