import type { PropsWithChildren } from 'react'
import { act, renderHook } from '@testing-library/react'
import { ReactFlowProvider, useStoreApi, type Node } from '@xyflow/react'
import { describe, expect, it, vi } from 'vitest'
import { useSynchronizedFlowNodes } from './useSynchronizedFlowNodes'

type TestFlowNode = Node<{ title: string }, 'test-node'>
const makeNode = (title = 'Первоначальный объект'): TestFlowNode => ({
  id: 'node-a',
  type: 'test-node',
  position: { x: 10, y: 20 },
  data: { title },
})
const wrapper = ({ children }: PropsWithChildren) => <ReactFlowProvider>{children}</ReactFlowProvider>

describe('синхронизация узлов графа', () => {
  it('сохраняет текущую позицию во время перетаскивания и фиксирует только итоговую', () => {
    const onPositionsSettled = vi.fn()
    const initialNodes = [makeNode()]
    const { result, rerender } = renderHook(({ nodes }) => {
      const onNodesChange = useSynchronizedFlowNodes(nodes, onPositionsSettled)
      const store = useStoreApi<TestFlowNode>()
      return {
        onNodesChange,
        getNodes: () => store.getState().nodes,
        setNodes: (nextNodes: TestFlowNode[]) => store.getState().setNodes(nextNodes),
      }
    }, { initialProps: { nodes: initialNodes }, wrapper })

    act(() => result.current.setNodes(initialNodes))
    act(() => result.current.onNodesChange([
      { type: 'position', id: 'node-a', position: { x: 42, y: 56 }, dragging: true },
    ]))
    expect(onPositionsSettled).not.toHaveBeenCalled()

    const externallyUpdatedNodes = [{
      ...makeNode('Обновлённые данные'),
      position: { x: 10, y: 20 },
    }]
    rerender({ nodes: externallyUpdatedNodes })
    expect(result.current.getNodes()[0]).toMatchObject({
      position: { x: 42, y: 56 },
      data: { title: 'Обновлённые данные' },
    })

    act(() => result.current.onNodesChange([
      { type: 'position', id: 'node-a', position: { x: 68, y: 84 }, dragging: false },
    ]))
    expect(onPositionsSettled).toHaveBeenCalledOnce()
    expect(onPositionsSettled).toHaveBeenCalledWith([{ id: 'node-a', position: { x: 68, y: 84 } }], [])

    rerender({ nodes: [{ ...makeNode('Обновлённые данные'), position: { x: 68, y: 84 } }] })
    expect(result.current.getNodes()[0]?.position).toEqual({ x: 68, y: 84 })
  })

  it('clears a pending drag position when that node is removed', () => {
    const onPositionsSettled = vi.fn()
    const initialNodes = [makeNode()]
    const { result, rerender } = renderHook(({ nodes }) => {
      const onNodesChange = useSynchronizedFlowNodes(nodes, onPositionsSettled)
      const store = useStoreApi<TestFlowNode>()
      return {
        onNodesChange,
        getNodes: () => store.getState().nodes,
        setNodes: (nextNodes: TestFlowNode[]) => store.getState().setNodes(nextNodes),
      }
    }, { initialProps: { nodes: initialNodes }, wrapper })

    act(() => result.current.setNodes(initialNodes))
    act(() => result.current.onNodesChange([
      { type: 'position', id: 'node-a', position: { x: 88, y: 99 }, dragging: true },
      { type: 'remove', id: 'node-a' },
    ]))
    expect(onPositionsSettled).toHaveBeenCalledWith([], ['node-a'])

    rerender({ nodes: [] })
    expect(result.current.getNodes()).toEqual([])

    const restoredNodes = [makeNode('Восстановленный объект')]
    rerender({ nodes: restoredNodes })
    expect(result.current.getNodes()[0]).toMatchObject({
      position: { x: 10, y: 20 },
      data: { title: 'Восстановленный объект' },
    })
  })
})
