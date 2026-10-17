import type { NodeType, Workspace } from '../domain/model'

export type GraphDirection = 'both' | 'outgoing' | 'incoming'
export type GraphTraversalMethod = 'breadth-first' | 'depth-first'

export type GraphNodeReference = Pick<Workspace['nodes'][number], 'id' | 'title' | 'type'>
export type GraphEdgeReference = Pick<Workspace['edges'][number], 'id' | 'sourceId' | 'targetId' | 'relationType'>

export type GraphSnapshot = {
  nodes: GraphNodeReference[]
  edges: GraphEdgeReference[]
}

export type GraphNodeDegree = {
  nodeId: string
  incoming: number
  outgoing: number
  total: number
}

export type GraphDuplicateTitleGroup = {
  normalizedTitle: string
  nodeIds: string[]
  titles: string[]
}

export type GraphOverview = {
  kind: 'overview'
  nodeCount: number
  edgeCount: number
  componentCount: number
  connectedComponents: string[][]
  isolatedNodeIds: string[]
  duplicateTitleGroups: GraphDuplicateTitleGroup[]
  degreeByNode: GraphNodeDegree[]
  typeCounts: Array<{ type: NodeType; count: number }>
  averageDegree: number
  maximumDegree: number
}

export type GraphNeighborsResult = {
  kind: 'neighbors'
  nodeId: string
  incomingNeighborIds: string[]
  outgoingNeighborIds: string[]
  incidentEdgeIds: string[]
}

export type GraphShortestPathResult = {
  kind: 'shortest-path'
  sourceId: string
  targetId: string
  direction: GraphDirection
  found: boolean
  nodeIds: string[]
  edgeIds: string[]
}

export type GraphTraversalResult = {
  kind: 'traversal'
  startId: string
  direction: GraphDirection
  method: GraphTraversalMethod
  nodeIds: string[]
  edgeIds: string[]
}

export type GraphQuery =
  | { kind: 'overview' }
  | { kind: 'neighbors'; nodeId: string }
  | {
      kind: 'shortest-path'
      sourceId: string
      targetId: string
      direction?: GraphDirection
    }
  | {
      kind: 'traverse'
      startId: string
      direction?: GraphDirection
      method: GraphTraversalMethod
    }

export type GraphQueryResult = GraphOverview | GraphNeighborsResult | GraphShortestPathResult | GraphTraversalResult

type GraphIndex = {
  nodeIds: string[]
  nodeIdsSet: Set<string>
  outgoingEdges: Map<string, GraphEdgeReference[]>
  incomingEdges: Map<string, GraphEdgeReference[]>
  degreeByNode: Map<string, { incoming: number; outgoing: number }>
}

/** Build a small, serializable view of the active workspace graph for local analysis. */
export function createGraphSnapshot(workspace: Pick<Workspace, 'nodes' | 'edges'>): GraphSnapshot {
  const nodes = workspace.nodes.filter((node) => !node.deletedAt).map(({ id, title, type }) => ({ id, title, type }))
  const activeIds = new Set(nodes.map((node) => node.id))
  const edges = workspace.edges
    .filter((edge) => activeIds.has(edge.sourceId) && activeIds.has(edge.targetId))
    .map(({ id, sourceId, targetId, relationType }) => ({
      id,
      sourceId,
      targetId,
      relationType,
    }))

  return { nodes, edges }
}

export function executeGraphQuery(graph: GraphSnapshot, query: GraphQuery): GraphQueryResult {
  const index = createGraphIndex(graph)

  switch (query.kind) {
    case 'overview':
      return getGraphOverviewFromIndex(graph, index)
    case 'neighbors':
      return getNeighborsFromIndex(index, query.nodeId)
    case 'shortest-path':
      return getShortestPath(index, query.sourceId, query.targetId, query.direction ?? 'both')
    case 'traverse':
      return traverseGraphFromIndex(index, query.startId, query.method, query.direction ?? 'both')
  }
}

export function getGraphOverview(graph: GraphSnapshot): GraphOverview {
  return getGraphOverviewFromIndex(graph, createGraphIndex(graph))
}

export function getNodeDegrees(graph: GraphSnapshot): GraphNodeDegree[] {
  const index = createGraphIndex(graph)
  return index.nodeIds.map((nodeId) => {
    const degree = index.degreeByNode.get(nodeId) ?? {
      incoming: 0,
      outgoing: 0,
    }
    return {
      nodeId,
      incoming: degree.incoming,
      outgoing: degree.outgoing,
      total: degree.incoming + degree.outgoing,
    }
  })
}

export function getNeighbors(graph: GraphSnapshot, nodeId: string): GraphNeighborsResult {
  return getNeighborsFromIndex(createGraphIndex(graph), nodeId)
}

export function findShortestPath(
  graph: GraphSnapshot,
  sourceId: string,
  targetId: string,
  direction: GraphDirection = 'both',
): GraphShortestPathResult {
  return getShortestPath(createGraphIndex(graph), sourceId, targetId, direction)
}

export function traverseGraph(
  graph: GraphSnapshot,
  startId: string,
  method: GraphTraversalMethod = 'breadth-first',
  direction: GraphDirection = 'both',
): GraphTraversalResult {
  return traverseGraphFromIndex(createGraphIndex(graph), startId, method, direction)
}

export function findConnectedComponents(graph: GraphSnapshot): string[][] {
  const index = createGraphIndex(graph)
  const visited = new Set<string>()
  const components: string[][] = []

  for (const startId of index.nodeIds) {
    if (visited.has(startId)) continue
    const component: string[] = []
    const pending = [startId]
    visited.add(startId)

    for (let cursor = 0; cursor < pending.length; cursor += 1) {
      const currentId = pending[cursor]
      if (currentId === undefined) continue
      component.push(currentId)
      for (const edge of getTraversableEdges(index, currentId, 'both')) {
        const neighborId = otherEndpoint(edge, currentId)
        if (neighborId && !visited.has(neighborId)) {
          visited.add(neighborId)
          pending.push(neighborId)
        }
      }
    }
    components.push(component)
  }

  return components
}

export function findExactTitleMatches(graph: GraphSnapshot): GraphDuplicateTitleGroup[] {
  const grouped = new Map<string, GraphNodeReference[]>()
  graph.nodes.forEach((node) => {
    const normalizedTitle = normalizeTitle(node.title)
    if (!normalizedTitle) return
    const group = grouped.get(normalizedTitle) ?? []
    group.push(node)
    grouped.set(normalizedTitle, group)
  })

  return [...grouped.entries()]
    .filter(([, nodes]) => nodes.length > 1)
    .map(([normalizedTitle, nodes]) => ({
      normalizedTitle,
      nodeIds: nodes.map((node) => node.id),
      titles: nodes.map((node) => node.title),
    }))
}

function getGraphOverviewFromIndex(graph: GraphSnapshot, index: GraphIndex): GraphOverview {
  const connectedComponents = findComponentsFromIndex(index)
  const degreeByNode = index.nodeIds.map((nodeId) => {
    const degree = index.degreeByNode.get(nodeId) ?? {
      incoming: 0,
      outgoing: 0,
    }
    return {
      nodeId,
      incoming: degree.incoming,
      outgoing: degree.outgoing,
      total: degree.incoming + degree.outgoing,
    }
  })
  const typeCounts = new Map<NodeType, number>()
  graph.nodes.forEach((node) => typeCounts.set(node.type, (typeCounts.get(node.type) ?? 0) + 1))
  const denominator = graph.nodes.length

  return {
    kind: 'overview',
    nodeCount: graph.nodes.length,
    edgeCount: [...index.outgoingEdges.values()].reduce((total, edges) => total + edges.length, 0),
    componentCount: connectedComponents.length,
    connectedComponents,
    isolatedNodeIds: degreeByNode.filter((degree) => degree.total === 0).map((degree) => degree.nodeId),
    duplicateTitleGroups: findExactTitleMatches(graph),
    degreeByNode,
    typeCounts: [...typeCounts.entries()].map(([type, count]) => ({
      type,
      count,
    })),
    averageDegree:
      denominator === 0 ? 0 : degreeByNode.reduce((total, degree) => total + degree.total, 0) / denominator,
    maximumDegree: degreeByNode.reduce((maximum, degree) => Math.max(maximum, degree.total), 0),
  }
}

function findComponentsFromIndex(index: GraphIndex): string[][] {
  const visited = new Set<string>()
  const components: string[][] = []

  for (const startId of index.nodeIds) {
    if (visited.has(startId)) continue
    const component: string[] = []
    const pending = [startId]
    visited.add(startId)

    for (let cursor = 0; cursor < pending.length; cursor += 1) {
      const currentId = pending[cursor]
      if (currentId === undefined) continue
      component.push(currentId)
      for (const edge of getTraversableEdges(index, currentId, 'both')) {
        const neighborId = otherEndpoint(edge, currentId)
        if (neighborId && !visited.has(neighborId)) {
          visited.add(neighborId)
          pending.push(neighborId)
        }
      }
    }
    components.push(component)
  }

  return components
}

function getNeighborsFromIndex(index: GraphIndex, nodeId: string): GraphNeighborsResult {
  ensureNodeExists(index, nodeId)
  const incoming = index.incomingEdges.get(nodeId) ?? []
  const outgoing = index.outgoingEdges.get(nodeId) ?? []

  return {
    kind: 'neighbors',
    nodeId,
    incomingNeighborIds: unique(incoming.map((edge) => edge.sourceId)),
    outgoingNeighborIds: unique(outgoing.map((edge) => edge.targetId)),
    incidentEdgeIds: unique([...incoming, ...outgoing].map((edge) => edge.id)),
  }
}

function getShortestPath(
  index: GraphIndex,
  sourceId: string,
  targetId: string,
  direction: GraphDirection,
): GraphShortestPathResult {
  ensureNodeExists(index, sourceId)
  ensureNodeExists(index, targetId)
  if (sourceId === targetId) {
    return {
      kind: 'shortest-path',
      sourceId,
      targetId,
      direction,
      found: true,
      nodeIds: [sourceId],
      edgeIds: [],
    }
  }

  const visited = new Set([sourceId])
  const parentByNode = new Map<string, { nodeId: string; edgeId: string }>()
  const pending = [sourceId]
  let targetFound = false

  for (let cursor = 0; cursor < pending.length && !targetFound; cursor += 1) {
    const currentId = pending[cursor]
    if (currentId === undefined) continue
    for (const edge of getTraversableEdges(index, currentId, direction)) {
      const nextId = getNextNodeId(edge, currentId, direction)
      if (!nextId || visited.has(nextId)) continue
      visited.add(nextId)
      parentByNode.set(nextId, { nodeId: currentId, edgeId: edge.id })
      if (nextId === targetId) {
        targetFound = true
        break
      }
      pending.push(nextId)
    }
  }

  if (!targetFound) {
    return {
      kind: 'shortest-path',
      sourceId,
      targetId,
      direction,
      found: false,
      nodeIds: [],
      edgeIds: [],
    }
  }

  const nodeIds = [targetId]
  const edgeIds: string[] = []
  let currentId = targetId
  while (currentId !== sourceId) {
    const parent = parentByNode.get(currentId)
    if (!parent) break
    edgeIds.push(parent.edgeId)
    currentId = parent.nodeId
    nodeIds.push(currentId)
  }

  return {
    kind: 'shortest-path',
    sourceId,
    targetId,
    direction,
    found: true,
    nodeIds: nodeIds.reverse(),
    edgeIds: edgeIds.reverse(),
  }
}

function traverseGraphFromIndex(
  index: GraphIndex,
  startId: string,
  method: GraphTraversalMethod,
  direction: GraphDirection,
): GraphTraversalResult {
  ensureNodeExists(index, startId)
  if (method === 'breadth-first') {
    const visited = new Set([startId])
    const pending = [startId]
    const nodeIds: string[] = []
    const edgeIds: string[] = []

    for (let cursor = 0; cursor < pending.length; cursor += 1) {
      const currentId = pending[cursor]
      if (currentId === undefined) continue
      nodeIds.push(currentId)
      for (const edge of getTraversableEdges(index, currentId, direction)) {
        const nextId = getNextNodeId(edge, currentId, direction)
        if (!nextId || visited.has(nextId)) continue
        visited.add(nextId)
        pending.push(nextId)
        edgeIds.push(edge.id)
      }
    }
    return { kind: 'traversal', startId, direction, method, nodeIds, edgeIds }
  }

  const visited = new Set<string>()
  const pending: Array<{ nodeId: string; parentEdgeId?: string }> = [{ nodeId: startId }]
  const nodeIds: string[] = []
  const edgeIds: string[] = []

  while (pending.length > 0) {
    const current = pending.pop()
    if (!current || visited.has(current.nodeId)) continue
    visited.add(current.nodeId)
    nodeIds.push(current.nodeId)
    if (current.parentEdgeId) edgeIds.push(current.parentEdgeId)

    const edges = getTraversableEdges(index, current.nodeId, direction)
    for (let edgeIndex = edges.length - 1; edgeIndex >= 0; edgeIndex -= 1) {
      const edge = edges[edgeIndex]
      if (!edge) continue
      const nextId = getNextNodeId(edge, current.nodeId, direction)
      if (!nextId || visited.has(nextId)) continue
      pending.push({ nodeId: nextId, parentEdgeId: edge.id })
    }
  }

  return { kind: 'traversal', startId, direction, method, nodeIds, edgeIds }
}

function createGraphIndex(graph: GraphSnapshot): GraphIndex {
  const nodeIds = graph.nodes.map((node) => node.id)
  const nodeIdsSet = new Set(nodeIds)
  const outgoingEdges = new Map<string, GraphEdgeReference[]>()
  const incomingEdges = new Map<string, GraphEdgeReference[]>()
  const degreeByNode = new Map(nodeIds.map((id) => [id, { incoming: 0, outgoing: 0 }]))

  nodeIds.forEach((nodeId) => {
    outgoingEdges.set(nodeId, [])
    incomingEdges.set(nodeId, [])
  })

  graph.edges.forEach((edge) => {
    if (!nodeIdsSet.has(edge.sourceId) || !nodeIdsSet.has(edge.targetId)) return
    outgoingEdges.get(edge.sourceId)?.push(edge)
    incomingEdges.get(edge.targetId)?.push(edge)
    const sourceDegree = degreeByNode.get(edge.sourceId)
    const targetDegree = degreeByNode.get(edge.targetId)
    if (sourceDegree) sourceDegree.outgoing += 1
    if (targetDegree) targetDegree.incoming += 1
  })

  return { nodeIds, nodeIdsSet, outgoingEdges, incomingEdges, degreeByNode }
}

function getTraversableEdges(index: GraphIndex, nodeId: string, direction: GraphDirection): GraphEdgeReference[] {
  if (direction === 'outgoing') return index.outgoingEdges.get(nodeId) ?? []
  if (direction === 'incoming') return index.incomingEdges.get(nodeId) ?? []
  return [...(index.outgoingEdges.get(nodeId) ?? []), ...(index.incomingEdges.get(nodeId) ?? [])]
}

function getNextNodeId(edge: GraphEdgeReference, currentId: string, direction: GraphDirection): string | null {
  if (direction === 'outgoing') return edge.sourceId === currentId ? edge.targetId : null
  if (direction === 'incoming') return edge.targetId === currentId ? edge.sourceId : null
  return otherEndpoint(edge, currentId)
}

function otherEndpoint(edge: GraphEdgeReference, currentId: string): string | null {
  if (edge.sourceId === currentId) return edge.targetId
  if (edge.targetId === currentId) return edge.sourceId
  return null
}

function ensureNodeExists(index: GraphIndex, nodeId: string): void {
  if (!index.nodeIdsSet.has(nodeId)) throw new Error(`Узел «${nodeId}» не найден среди активных узлов графа.`)
}

function normalizeTitle(title: string): string {
  return title.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)]
}
