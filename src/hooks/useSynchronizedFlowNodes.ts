import { useCallback, useEffect, useRef } from 'react'
import { useStoreApi, type Node, type NodeChange, type XYPosition } from '@xyflow/react'

export type FlowNodePositionSnapshot = { id: string; position: XYPosition }
export type FlowNodeChangeHandler<NodeType extends Node> = (changes: NodeChange<NodeType>[]) => void

type PositionsSettledHandler = (positions: FlowNodePositionSnapshot[], removedIds: string[]) => void

/** Merge React Flow's live drag positions into newer workspace-backed node data. */
export function mergeActiveFlowPositions<NodeType extends Node>(
  nodes: readonly NodeType[],
  activePositions: ReadonlyMap<string, XYPosition>,
): NodeType[] {
  return nodes.map((node) => {
    const position = activePositions.get(node.id)
    return position ? { ...node, position } : node
  })
}

/**
 * Keep high-frequency drag updates inside React Flow's store, then persist only
 * settled positions. External node data is synchronized without interrupting an
 * in-progress drag.
 */
export function useSynchronizedFlowNodes<NodeType extends Node>(
  nodes: NodeType[],
  onPositionsSettled: PositionsSettledHandler,
): FlowNodeChangeHandler<NodeType> {
  const store = useStoreApi<NodeType>()
  const activePositions = useRef(new Map<string, XYPosition>())
  const previousNodes = useRef(nodes)

  const onNodesChange = useCallback((changes: NodeChange<NodeType>[]) => {
    const settledPositions: FlowNodePositionSnapshot[] = []
    const removedIds: string[] = []

    changes.forEach((change) => {
      if (change.type === 'position') {
        if (!change.position) return
        if (change.dragging === true) {
          activePositions.current.set(change.id, change.position)
        } else {
          activePositions.current.delete(change.id)
          settledPositions.push({ id: change.id, position: change.position })
        }
      } else if (change.type === 'remove') {
        activePositions.current.delete(change.id)
        removedIds.push(change.id)
      }
    })

    if (settledPositions.length > 0 || removedIds.length > 0) {
      onPositionsSettled(settledPositions, removedIds)
    }
  }, [onPositionsSettled])

  useEffect(() => {
    if (previousNodes.current === nodes) return
    previousNodes.current = nodes

    const nodeIds = new Set(nodes.map((node) => node.id))
    activePositions.current.forEach((_position, id) => {
      if (!nodeIds.has(id)) activePositions.current.delete(id)
    })

    store.getState().setNodes(mergeActiveFlowPositions(nodes, activePositions.current))
  }, [nodes, store])

  return onNodesChange
}
