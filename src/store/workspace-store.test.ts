import { beforeEach, describe, expect, it } from 'vitest'
import { createInitialWorkspace } from '../domain/seed'
import { useWorkspaceStore } from './workspace-store'

describe('workspace recycle and favorites', () => {
  beforeEach(() => {
    const workspace = createInitialWorkspace()
    useWorkspaceStore.setState({
      workspace,
      workspaces: [{ id: workspace.id, name: workspace.name, updatedAt: workspace.updatedAt }],
      isReady: true,
      saveStatus: 'saved',
      selectedNodeId: 'neural-canvas',
    })
  })

  it('trashes and restores nodes without losing their connections', () => {
    const initialEdges = useWorkspaceStore.getState().workspace.edges.length
    useWorkspaceStore.getState().trashNode('neural-canvas')
    const trashed = useWorkspaceStore.getState()
    expect(trashed.workspace.nodes.find((node) => node.id === 'neural-canvas')?.deletedAt).toBeTruthy()
    expect(trashed.workspace.edges).toHaveLength(initialEdges)
    expect(trashed.selectedNodeId).toBeNull()

    trashed.restoreNode('neural-canvas')
    const restored = useWorkspaceStore.getState()
    expect(restored.workspace.nodes.find((node) => node.id === 'neural-canvas')?.deletedAt).toBeUndefined()
    expect(restored.workspace.edges).toHaveLength(initialEdges)
  })

  it('creates only explicitly requested connections', () => {
    const store = useWorkspaceStore.getState()
    const initialEdgeCount = store.workspace.edges.length
    store.addNode('idea', { x: 1200, y: 700 })
    expect(useWorkspaceStore.getState().workspace.edges).toHaveLength(initialEdgeCount)

    store.addNode('note', { x: 1500, y: 700 }, 'neural-canvas')
    const edges = useWorkspaceStore.getState().workspace.edges
    expect(edges).toHaveLength(initialEdgeCount + 1)
    expect(edges.at(-1)).toMatchObject({ sourceId: 'neural-canvas' })
  })

  it('adds typed relations, preserves metadata, permits ordinary cycles, and blocks dependency cycles', () => {
    const store = useWorkspaceStore.getState()
    const initialEdgeCount = store.workspace.edges.length
    store.addEdge('neural-canvas', 'systems-thinking', 'supports', 'Strengthens the principle', { confidence: 0.82 })
    store.addEdge('systems-thinking', 'knowledge-graph', 'depends_on', 'Needs the graph')
    store.addEdge('knowledge-graph', 'systems-thinking', 'depends_on', 'Would close a dependency loop')
    store.addEdge('missing-node', 'neural-canvas', 'references', 'Invalid endpoint')

    const edges = useWorkspaceStore.getState().workspace.edges
    expect(edges).toHaveLength(initialEdgeCount + 2)
    expect(edges.at(-2)).toMatchObject({
      sourceId: 'neural-canvas',
      targetId: 'systems-thinking',
      relationType: 'supports',
      label: 'Strengthens the principle',
      metadata: { confidence: 0.82 },
    })
    expect(edges.at(-1)).toMatchObject({ sourceId: 'systems-thinking', targetId: 'knowledge-graph', relationType: 'depends_on' })
  })

  it('updates existing connection captions and rejects empty or oversized labels', () => {
    const edge = useWorkspaceStore.getState().workspace.edges[0]!
    useWorkspaceStore.getState().updateEdgeLabel(edge.id, '  Нужная пользователю подпись  ')
    expect(useWorkspaceStore.getState().workspace.edges.find((item) => item.id === edge.id)?.label).toBe('Нужная пользователю подпись')

    useWorkspaceStore.getState().updateEdgeLabel(edge.id, '   ')
    useWorkspaceStore.getState().updateEdgeLabel(edge.id, 'x'.repeat(81))
    expect(useWorkspaceStore.getState().workspace.edges.find((item) => item.id === edge.id)?.label).toBe('Нужная пользователю подпись')
  })

  it('persists developer task and architecture-note metadata and cleans project references on type conversion', () => {
    const store = useWorkspaceStore.getState()
    store.updateNode('capture-idea', { taskStatus: 'done', priority: 'critical', dueDate: '2026-10-30', projectId: 'developer-flow' })
    const note = useWorkspaceStore.getState().addArchitectureNote('algorithm', 'developer-flow')!
    useWorkspaceStore.getState().updateArchitectureNote(note.id, {
      title: 'Graph layout algorithm',
      content: 'Describe the placement strategy and its tradeoffs.',
      code: 'const layout = "display only"',
      codeLanguage: 'typescript',
      tags: ['layout', 'algorithm'],
      relatedNodeIds: ['systems-thinking'],
    })

    expect(useWorkspaceStore.getState().workspace.nodes.find((node) => node.id === 'capture-idea')).toMatchObject({ taskStatus: 'done', status: 'done', priority: 'critical', dueDate: '2026-10-30', projectId: 'developer-flow' })
    expect(useWorkspaceStore.getState().workspace.architectureNotes.find((item) => item.id === note.id)).toMatchObject({ title: 'Graph layout algorithm', projectId: 'developer-flow', codeLanguage: 'typescript', relatedNodeIds: ['systems-thinking'] })

    useWorkspaceStore.getState().updateNode('developer-flow', { type: 'idea' })
    expect(useWorkspaceStore.getState().workspace.nodes.find((node) => node.id === 'capture-idea')?.projectId).toBeNull()
    expect(useWorkspaceStore.getState().workspace.architectureNotes.find((item) => item.id === note.id)?.projectId).toBeNull()
  })

  it('applies batched position changes for a moved selection', () => {
    const store = useWorkspaceStore.getState()
    store.syncFlowNodes([
      { id: 'systems-thinking', position: { x: 300, y: 260 } },
      { id: 'knowledge-graph', position: { x: 560, y: 410 } },
    ], [])
    const movedNodes = useWorkspaceStore.getState().workspace.nodes
    expect(movedNodes.find((node) => node.id === 'systems-thinking')?.position).toEqual({ x: 300, y: 260 })
    expect(movedNodes.find((node) => node.id === 'knowledge-graph')?.position).toEqual({ x: 560, y: 410 })
  })

  it('soft-deletes removed graph nodes while preserving connections for restoration', () => {
    const initialEdges = useWorkspaceStore.getState().workspace.edges
    useWorkspaceStore.getState().setSelectedNodeId('systems-thinking')
    useWorkspaceStore.getState().syncFlowNodes([], ['systems-thinking'])

    const trashed = useWorkspaceStore.getState()
    expect(trashed.workspace.nodes.find((node) => node.id === 'systems-thinking')?.deletedAt).toBeTruthy()
    expect(trashed.workspace.edges).toEqual(initialEdges)
    expect(trashed.selectedNodeId).toBeNull()

    trashed.restoreNode('systems-thinking')
    const restored = useWorkspaceStore.getState()
    expect(restored.workspace.nodes.find((node) => node.id === 'systems-thinking')?.deletedAt).toBeUndefined()
    expect(restored.workspace.edges).toEqual(initialEdges)
  })

  it('duplicates object metadata without duplicating its explicit connections', () => {
    const store = useWorkspaceStore.getState()
    store.updateNode('systems-thinking', {
      color: 'rose',
      properties: [{ id: 'property-origin', name: 'Source', value: 'Workshop' }],
      tags: ['principle', 'thinking'],
    })
    const before = useWorkspaceStore.getState().workspace
    const source = before.nodes.find((node) => node.id === 'systems-thinking')!
    const sourceEdges = before.edges.filter((edge) => edge.sourceId === source.id || edge.targetId === source.id)
    const duplicate = useWorkspaceStore.getState().duplicateNode(source.id, { x: 900, y: 620 })

    expect(duplicate).not.toBeNull()
    expect(duplicate).toMatchObject({
      type: source.type,
      title: 'Идеи становятся системами (копия)',
      description: source.description,
      color: 'rose',
      tags: source.tags,
      position: { x: 900, y: 620 },
      favorite: false,
    })
    expect(duplicate?.id).not.toBe(source.id)
    expect(duplicate?.properties?.[0]).toMatchObject({ name: 'Source', value: 'Workshop' })
    expect(duplicate?.properties?.[0]?.id).not.toBe('property-origin')

    const after = useWorkspaceStore.getState()
    expect(after.workspace.edges).toEqual(before.edges)
    expect(after.workspace.edges.filter((edge) => edge.sourceId === duplicate?.id || edge.targetId === duplicate?.id)).toHaveLength(0)
    expect(after.selectedNodeId).toBe(duplicate?.id)
    expect(sourceEdges.length).toBeGreaterThan(0)
  })

  it('persists inspector color, custom properties, and user-edited timestamps in workspace state', () => {
    const store = useWorkspaceStore.getState()
    const createdAt = '2021-06-07T08:09:00.000Z'
    const updatedAt = '2022-09-08T10:11:00.000Z'
    store.updateNode('systems-thinking', {
      color: 'amber',
      createdAt,
      updatedAt,
      properties: [{ id: 'custom-source', name: 'Owner', value: 'R&D' }],
    })

    const updated = useWorkspaceStore.getState().workspace.nodes.find((node) => node.id === 'systems-thinking')
    expect(updated).toMatchObject({ color: 'amber', createdAt, updatedAt })
    expect(updated?.properties).toEqual([{ id: 'custom-source', name: 'Owner', value: 'R&D' }])
  })

  it('toggles favorites and permanently deletes a node with its links', () => {
    const store = useWorkspaceStore.getState()
    expect(store.workspace.nodes.find((node) => node.id === 'systems-thinking')?.favorite).toBe(false)
    store.toggleFavorite('systems-thinking')
    expect(useWorkspaceStore.getState().workspace.nodes.find((node) => node.id === 'systems-thinking')?.favorite).toBe(true)
    useWorkspaceStore.getState().toggleFavorite('systems-thinking')
    expect(useWorkspaceStore.getState().workspace.nodes.find((node) => node.id === 'systems-thinking')?.favorite).toBe(false)

    useWorkspaceStore.getState().deleteNode('neural-canvas')
    const workspace = useWorkspaceStore.getState().workspace
    expect(workspace.nodes.some((node) => node.id === 'neural-canvas')).toBe(false)
    expect(workspace.edges.some((edge) => edge.sourceId === 'neural-canvas' || edge.targetId === 'neural-canvas')).toBe(false)
  })
})
