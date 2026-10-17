import { useRef, useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { handleMenuKeyDown, useDialogAccessibility } from './useDialogAccessibility'

function DialogHarness() {
  const [open, setOpen] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const firstControlRef = useRef<HTMLButtonElement>(null)
  useDialogAccessibility(dialogRef, () => firstControlRef.current, () => setOpen(false), open)

  return (
    <>
      <button onClick={() => setOpen(true)}>Open modal</button>
      {open && (
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Test dialog" tabIndex={-1}>
          <button ref={firstControlRef}>First action</button>
          <button>Last action</button>
        </div>
      )}
    </>
  )
}

function MenuHarness({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="menu"
      aria-label="Test menu"
      onKeyDown={(event) => handleMenuKeyDown(event, onClose)}
    >
      <button role="menuitem">First item</button>
      <button role="menuitem">Second item</button>
      <button role="menuitem">Last item</button>
    </div>
  )
}

describe('dialog and menu keyboard accessibility', () => {
  it('focuses, traps, and restores modal focus, and closes on Escape', async () => {
    const user = userEvent.setup()
    render(<DialogHarness />)
    const opener = screen.getByRole('button', { name: 'Open modal' })

    await user.click(opener)
    const first = screen.getByRole('button', { name: 'First action' })
    const last = screen.getByRole('button', { name: 'Last action' })
    expect(first).toHaveFocus()

    await user.tab()
    expect(last).toHaveFocus()
    await user.tab()
    expect(first).toHaveFocus()
    await user.tab({ shift: true })
    expect(last).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Test dialog' })).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })

  it('supports arrow, Home, End, and Escape keys in ARIA menus', () => {
    const onClose = vi.fn()
    render(<MenuHarness onClose={onClose} />)
    const first = screen.getByRole('menuitem', { name: 'First item' })
    const second = screen.getByRole('menuitem', { name: 'Second item' })
    const last = screen.getByRole('menuitem', { name: 'Last item' })

    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowDown' })
    expect(second).toHaveFocus()
    fireEvent.keyDown(second, { key: 'End' })
    expect(last).toHaveFocus()
    fireEvent.keyDown(last, { key: 'Home' })
    expect(first).toHaveFocus()
    fireEvent.keyDown(first, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })
})
