import type { CanvasEdgeData, CanvasNodeData, Workspace } from '../domain/model'

export type ConnectionInsight = {
  first: CanvasNodeData
  second: CanvasNodeData
  sharedTag?: string
  connected: boolean
}

function isConnected(edges: CanvasEdgeData[], firstId: string, secondId: string) {
  return edges.some((edge) =>
    (edge.sourceId === firstId && edge.targetId === secondId)
    || (edge.sourceId === secondId && edge.targetId === firstId),
  )
}

/** A small, transparent local heuristic: surface two unlinked nodes that share a tag. */
export function findConnectionInsight(workspace: Workspace): ConnectionInsight | null {
  const nodes = workspace.nodes.filter((node) => !node.deletedAt)
  const liveIds = new Set(nodes.map((node) => node.id))
  const edges = workspace.edges.filter((edge) => liveIds.has(edge.sourceId) && liveIds.has(edge.targetId))
  let best: ConnectionInsight | null = null
  let bestScore = 0

  for (let firstIndex = 0; firstIndex < nodes.length; firstIndex += 1) {
    const first = nodes[firstIndex]
    if (!first) continue
    for (let secondIndex = firstIndex + 1; secondIndex < nodes.length; secondIndex += 1) {
      const second = nodes[secondIndex]
      if (!second) continue
      const sharedTag = first.tags.find((tag) => second.tags.includes(tag))
      if (!sharedTag) continue
      const connected = isConnected(edges, first.id, second.id)
      if (connected) continue
      const score = Math.min(first.tags.length + second.tags.length, 6) / 10
      if (score > bestScore) {
        best = { first, second, sharedTag, connected: false }
        bestScore = score
      }
    }
  }

  return best
}

export function countConnectedNodes(workspace: Workspace) {
  const connectedIds = new Set(workspace.edges.flatMap((edge) => [edge.sourceId, edge.targetId]))
  return connectedIds.size
}
