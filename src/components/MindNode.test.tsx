import { fireEvent, render, screen } from '@testing-library/react'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import { describe, expect, it, vi } from 'vitest'
import { createInitialWorkspace } from '../domain/seed'
import MindNode, { type FlowNode } from './MindNode'

const workspace = createInitialWorkspace()
const idea = workspace.nodes.find((node) => node.id === 'systems-thinking')!

function firePointer(
  target: Element,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  options: { pointerId: number; button?: number; clientX: number; clientY: number },
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: options.button ?? 0,
    clientX: options.clientX,
    clientY: options.clientY,
  })
  Object.defineProperty(event, 'pointerId', { value: options.pointerId })
  fireEvent(target, event)
}

function renderIdea(onFrameResize = vi.fn()) {
  const props = {
    id: idea.id,
    data: { ...idea, onFrameResize },
    selected: false,
  } as unknown as NodeProps<FlowNode>

  const result = render(
    <ReactFlowProvider>
      <MindNode {...props} />
    </ReactFlowProvider>,
  )

  return { ...result, onFrameResize }
}

describe('изменение размера карточки идеи', () => {
  it('изменяет и сохраняет рамку при перетаскивании угловой ручки', () => {
    const { container, onFrameResize } = renderIdea()
    const article = container.querySelector<HTMLElement>('.mind-node')!
    vi.spyOn(article, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, top: 0, right: 280, bottom: 156, left: 0, width: 280, height: 156,
      toJSON: () => ({}),
    } as DOMRect)
    const handle = screen.getByRole('button', { name: 'Изменить размер рамки идеи «Идеи становятся системами»' })

    firePointer(handle, 'pointerdown', { pointerId: 1, button: 0, clientX: 100, clientY: 100 })
    firePointer(handle, 'pointermove', { pointerId: 1, clientX: 160, clientY: 140 })
    expect(article).toHaveStyle({ width: '340px', height: '196px' })
    firePointer(handle, 'pointerup', { pointerId: 1, button: 0, clientX: 160, clientY: 140 })

    expect(onFrameResize).toHaveBeenCalledWith(idea.id, { width: 340, height: 196 })
  })

  it('позволяет менять размер с клавиатуры и сообщает об управлении', () => {
    const { onFrameResize } = renderIdea()
    const handle = screen.getByRole('button', { name: 'Изменить размер рамки идеи «Идеи становятся системами»' })

    expect(handle).toHaveAttribute('aria-describedby')
    expect(handle).toHaveAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight ArrowUp ArrowDown Enter Space')
    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    fireEvent.keyDown(handle, { key: 'ArrowDown', shiftKey: true })
    fireEvent.keyDown(handle, { key: 'Enter' })

    expect(onFrameResize).toHaveBeenNthCalledWith(1, idea.id, { width: 300, height: 156 })
    expect(onFrameResize).toHaveBeenNthCalledWith(2, idea.id, { width: 280, height: 196 })
    expect(onFrameResize).toHaveBeenNthCalledWith(3, idea.id, { width: 300, height: 176 })
  })

  it('не показывает ручку изменения размера у карточек других типов', () => {
    const task = workspace.nodes.find((node) => node.type === 'task')!
    const props = { id: task.id, data: task, selected: false } as unknown as NodeProps<FlowNode>
    render(
      <ReactFlowProvider>
        <MindNode {...props} />
      </ReactFlowProvider>,
    )

    expect(screen.queryByRole('button', { name: /Изменить размер рамки идеи/ })).not.toBeInTheDocument()
  })
})
