import { afterEach, describe, expect, it, vi } from 'vitest'
import { createInitialWorkspace } from '../domain/seed'
import type { CanvasEdgeData, CanvasNodeData, NodeType, RelationType, Workspace } from '../domain/model'
import {
  createGraphSnapshot,
  executeGraphQuery,
  findConnectedComponents,
  findExactTitleMatches,
  findShortestPath,
  getGraphOverview,
  getNeighbors,
  getNodeDegrees,
  traverseGraph,
} from './graph-intelligence'
import { GRAPH_WORKER_NODE_THRESHOLD, runGraphQuery } from './graph-intelligence-client'

afterEach(() => vi.unstubAllGlobals())

const timestamp = '2026-01-15T10:00:00.000Z'

function makeNode(id: string, title: string, type: NodeType = 'idea', deletedAt?: string): CanvasNodeData {
  return {
    id,
    type,
    title,
    description: '',
    tags: [],
    color: 'violet',
    createdAt: timestamp,
    updatedAt: timestamp,
    position: { x: 0, y: 0 },
    favorite: false,
    properties: [],
    status: 'active',
    priority: 'medium',
    ...(deletedAt ? { deletedAt } : {}),
  }
}

function makeEdge(
  id: string,
  sourceId: string,
  targetId: string,
  relationType: RelationType = 'related_to',
): CanvasEdgeData {
  return {
    id,
    sourceId,
    targetId,
    relationType,
    label: relationType,
    createdAt: timestamp,
  }
}

function makeWorkspace(nodes: CanvasNodeData[], edges: CanvasEdgeData[]): Workspace {
  return { ...createInitialWorkspace(), nodes, edges }
}

function connectedFixture() {
  return makeWorkspace(
    [
      makeNode('a', 'Alpha', 'idea'),
      makeNode('b', 'Beta', 'concept'),
      makeNode('c', 'Gamma', 'idea'),
      makeNode('d', 'Delta', 'task'),
      makeNode('e', 'Alone', 'note'),
      makeNode('hidden', 'Archived thought', 'resource', timestamp),
    ],
    [
      makeEdge('ab', 'a', 'b'),
      makeEdge('ac', 'a', 'c'),
      makeEdge('bd', 'b', 'd'),
      makeEdge('cd', 'c', 'd'),
      makeEdge('hidden-link', 'a', 'hidden'),
    ],
  )
}

describe('local graph intelligence', () => {
  it('builds a live graph snapshot and counts directed in/out degrees and isolated nodes', () => {
    const graph = createGraphSnapshot(connectedFixture())

    expect(graph.nodes.map((node) => node.id)).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(graph.edges.map((edge) => edge.id)).toEqual(['ab', 'ac', 'bd', 'cd'])
    expect(getNodeDegrees(graph)).toEqual([
      { nodeId: 'a', incoming: 0, outgoing: 2, total: 2 },
      { nodeId: 'b', incoming: 1, outgoing: 1, total: 2 },
      { nodeId: 'c', incoming: 1, outgoing: 1, total: 2 },
      { nodeId: 'd', incoming: 2, outgoing: 0, total: 2 },
      { nodeId: 'e', incoming: 0, outgoing: 0, total: 0 },
    ])
  })

  it('returns unique direct neighbors and incident connections by direction', () => {
    const result = getNeighbors(createGraphSnapshot(connectedFixture()), 'b')

    expect(result).toEqual({
      kind: 'neighbors',
      nodeId: 'b',
      incomingNeighborIds: ['a'],
      outgoingNeighborIds: ['d'],
      incidentEdgeIds: ['ab', 'bd'],
    })
  })

  it('finds a shortest path with BFS and respects forward, backward, or either direction', () => {
    const graph = createGraphSnapshot(connectedFixture())

    expect(findShortestPath(graph, 'a', 'd', 'outgoing')).toMatchObject({
      found: true,
      nodeIds: ['a', 'b', 'd'],
      edgeIds: ['ab', 'bd'],
    })
    expect(findShortestPath(graph, 'd', 'a', 'incoming')).toMatchObject({
      found: true,
      nodeIds: ['d', 'b', 'a'],
      edgeIds: ['bd', 'ab'],
    })
    expect(findShortestPath(graph, 'e', 'a', 'both')).toMatchObject({
      found: false,
      nodeIds: [],
      edgeIds: [],
    })
    expect(findShortestPath(graph, 'a', 'a')).toMatchObject({
      found: true,
      nodeIds: ['a'],
      edgeIds: [],
    })
  })

  it('traverses reachable nodes in breadth-first and depth-first order without repeats', () => {
    const graph = createGraphSnapshot(connectedFixture())

    expect(traverseGraph(graph, 'a', 'breadth-first', 'outgoing')).toMatchObject({
      nodeIds: ['a', 'b', 'c', 'd'],
      edgeIds: ['ab', 'ac', 'bd'],
    })
    expect(traverseGraph(graph, 'a', 'depth-first', 'outgoing')).toMatchObject({
      nodeIds: ['a', 'b', 'd', 'c'],
      edgeIds: ['ab', 'bd', 'ac'],
    })
    expect(traverseGraph(graph, 'd', 'breadth-first', 'incoming').nodeIds).toEqual(['d', 'b', 'c', 'a'])
  })

  it('keeps depth-first discovery links consistent with branch order', () => {
    const graph = createGraphSnapshot(
      makeWorkspace(
        [makeNode('a', 'Alpha'), makeNode('b', 'Beta'), makeNode('c', 'Gamma')],
        [makeEdge('ab', 'a', 'b'), makeEdge('ac', 'a', 'c'), makeEdge('bc', 'b', 'c')],
      ),
    )

    expect(traverseGraph(graph, 'a', 'depth-first', 'outgoing')).toMatchObject({
      nodeIds: ['a', 'b', 'c'],
      edgeIds: ['ab', 'bc'],
    })
  })

  it('terminates on cycles without suppressing cycle-capable relationships', () => {
    const graph = createGraphSnapshot(
      makeWorkspace(
        [makeNode('a', 'Alpha'), makeNode('b', 'Beta'), makeNode('c', 'Gamma')],
        [
          makeEdge('ab', 'a', 'b', 'related_to'),
          makeEdge('bc', 'b', 'c', 'related_to'),
          makeEdge('ca', 'c', 'a', 'related_to'),
        ],
      ),
    )

    expect(traverseGraph(graph, 'a', 'breadth-first', 'outgoing').nodeIds).toEqual(['a', 'b', 'c'])
    expect(findConnectedComponents(graph)).toEqual([['a', 'b', 'c']])
  })

  it('finds weakly connected components, including isolated nodes as singleton groups', () => {
    const graph = createGraphSnapshot(connectedFixture())
    expect(findConnectedComponents(graph)).toEqual([['a', 'b', 'c', 'd'], ['e']])

    const overview = getGraphOverview(graph)
    expect(overview).toMatchObject({
      nodeCount: 5,
      edgeCount: 4,
      componentCount: 2,
      isolatedNodeIds: ['e'],
      averageDegree: 1.6,
      maximumDegree: 2,
    })
    expect(overview.typeCounts).toEqual([
      { type: 'idea', count: 2 },
      { type: 'concept', count: 1 },
      { type: 'task', count: 1 },
      { type: 'note', count: 1 },
    ])
  })

  it('groups only normalized exact-title matches, never inferring semantic identity', () => {
    const graph = createGraphSnapshot(
      makeWorkspace(
        [
          makeNode('one', '  Same title '),
          makeNode('two', 'same   title', 'concept'),
          makeNode('three', 'Same title, different meaning'),
          makeNode('four', 'Unique'),
        ],
        [],
      ),
    )

    expect(findExactTitleMatches(graph)).toEqual([
      {
        normalizedTitle: 'same title',
        nodeIds: ['one', 'two'],
        titles: ['  Same title ', 'same   title'],
      },
    ])
  })

  it('runs typed requests against a serializable snapshot', async () => {
    const result = await runGraphQuery(connectedFixture(), {
      kind: 'neighbors',
      nodeId: 'a',
    })
    expect(result).toEqual({
      kind: 'neighbors',
      nodeId: 'a',
      incomingNeighborIds: [],
      outgoingNeighborIds: ['b', 'c'],
      incidentEdgeIds: ['ab', 'ac'],
    })
    expect(
      executeGraphQuery(createGraphSnapshot(connectedFixture()), {
        kind: 'overview',
      }).kind,
    ).toBe('overview')
  })

  it('refuses to run a large graph synchronously when Web Workers are unavailable', async () => {
    vi.stubGlobal('Worker', undefined)
    const nodes = Array.from({ length: GRAPH_WORKER_NODE_THRESHOLD }, (_, index) =>
      makeNode(`large-${index}`, `Node ${index}`),
    )

    await expect(runGraphQuery(makeWorkspace(nodes, []), { kind: 'overview' })).rejects.toThrow(
      'Данные не анализировались в интерфейсе',
    )
  })

  it('reports a clear error for a missing node rather than returning invented graph data', () => {
    expect(() => getNeighbors(createGraphSnapshot(connectedFixture()), 'not-here')).toThrow(
      'не найден среди активных узлов графа',
    )
  })
})
