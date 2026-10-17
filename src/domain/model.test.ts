import { describe, expect, it } from 'vitest'
import { createInitialWorkspace } from './seed'
import { getRelationCaption, nodeTypes, relationTypes, workspaceSchema } from './model'

const makeEdge = (
  id: string,
  sourceId: string,
  targetId: string,
  relationType: 'related_to' | 'depends_on' | 'supports' = 'related_to',
) => ({
  id,
  sourceId,
  targetId,
  relationType,
  label: relationType,
  createdAt: '2026-10-17T00:00:00.000Z',
})

describe('workspace data contract', () => {
  it('uses a custom connection caption in place of its default relation label', () => {
    expect(getRelationCaption({ relationType: 'related_to', label: 'Опирается на идею' })).toBe('Опирается на идею')
    expect(getRelationCaption({ relationType: 'related_to', label: '  ' })).toBe('Связано с')
  })

  it('accepts the example knowledge workspace', () => {
    const workspace = createInitialWorkspace()
    expect(workspaceSchema.parse(workspace).nodes).toHaveLength(9)
    expect(workspace.edges).toHaveLength(10)
  })

  it('supports every required node type with all canonical required fields', () => {
    const workspace = createInitialWorkspace()
    const template = workspace.nodes[0]!
    const typedNodes = nodeTypes.map((type, index) => ({
      ...template,
      id: `type-${type}`,
      type,
      title: `${type} node`,
      position: { x: index * 10, y: index * 5 },
      tags: [],
      favorite: false,
      properties: [],
    }))
    const parsed = workspaceSchema.safeParse({ ...workspace, nodes: [...workspace.nodes, ...typedNodes] })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.nodes.slice(-nodeTypes.length).map((node) => node.type)).toEqual(nodeTypes)
  })

  it('persists bounded frame sizes for ideas while keeping other node types unchanged', () => {
    const workspace = createInitialWorkspace()
    const resized = workspaceSchema.parse({
      ...workspace,
      nodes: workspace.nodes.map((node) => node.id === 'systems-thinking'
        ? { ...node, frameSize: { width: 520, height: 320 } }
        : node),
    })
    expect(resized.nodes.find((node) => node.id === 'systems-thinking')?.frameSize)
      .toEqual({ width: 520, height: 320 })

    const nonIdeaSize = {
      ...workspace,
      nodes: workspace.nodes.map((node) => node.id === 'knowledge-graph'
        ? { ...node, frameSize: { width: 520, height: 320 } }
        : node),
    }
    expect(workspaceSchema.safeParse(nonIdeaSize).success).toBe(false)

    const oversizedIdea = {
      ...workspace,
      nodes: workspace.nodes.map((node) => node.id === 'systems-thinking'
        ? { ...node, frameSize: { width: 641, height: 320 } }
        : node),
    }
    expect(workspaceSchema.safeParse(oversizedIdea).success).toBe(false)
  })

  it('supports every required relation type on canonical edges', () => {
    const workspace = createInitialWorkspace()
    const edges = relationTypes.map((relationType) => ({
      id: `relation-${relationType}`,
      sourceId: 'systems-thinking',
      targetId: 'knowledge-graph',
      relationType,
      label: relationType,
      createdAt: workspace.updatedAt,
    }))
    expect(workspaceSchema.safeParse({ ...workspace, edges: [...workspace.edges, ...edges] }).success).toBe(true)
  })

  it('rejects missing required node fields and unknown node types', () => {
    const workspace = createInitialWorkspace()
    const { favorite: _favorite, ...missingFavorite } = workspace.nodes[0]!
    expect(workspaceSchema.safeParse({ ...workspace, nodes: [missingFavorite, ...workspace.nodes.slice(1)] }).success).toBe(false)
    expect(workspaceSchema.safeParse({
      ...workspace,
      nodes: [{ ...workspace.nodes[0], type: 'unknown' }, ...workspace.nodes.slice(1)],
    }).success).toBe(false)

    const { relationType: _relationType, ...missingRelationType } = workspace.edges[0]!
    expect(workspaceSchema.safeParse({ ...workspace, edges: [missingRelationType, ...workspace.edges.slice(1)] }).success).toBe(false)
  })

  it('rejects connections that point to missing nodes', () => {
    const workspace = createInitialWorkspace()
    const invalid = {
      ...workspace,
      edges: [...workspace.edges, makeEdge('broken', 'missing', 'neural-canvas')],
    }
    expect(workspaceSchema.safeParse(invalid).success).toBe(false)
  })

  it('rejects duplicate node identifiers', () => {
    const workspace = createInitialWorkspace()
    const invalid = { ...workspace, nodes: [...workspace.nodes, { ...workspace.nodes[0]! }] }
    expect(workspaceSchema.safeParse(invalid).success).toBe(false)
  })

  it('allows cycles for ordinary relations but prevents dependency cycles', () => {
    const workspace = createInitialWorkspace()
    const ordinaryRelationCycle = {
      ...workspace,
      edges: [
        ...workspace.edges,
        makeEdge('supports-one', 'systems-thinking', 'knowledge-graph', 'supports'),
        makeEdge('supports-two', 'knowledge-graph', 'systems-thinking', 'supports'),
      ],
    }
    expect(workspaceSchema.safeParse(ordinaryRelationCycle).success).toBe(true)

    const dependencyCycle = {
      ...workspace,
      edges: [
        ...workspace.edges,
        makeEdge('depends-one', 'systems-thinking', 'knowledge-graph', 'depends_on'),
        makeEdge('depends-two', 'knowledge-graph', 'systems-thinking', 'depends_on'),
      ],
    }
    expect(workspaceSchema.safeParse(dependencyCycle).success).toBe(false)
  })

  it('preserves developer project, task, and architecture-note fields in the strict workspace model', () => {
    const workspace = createInitialWorkspace()
    const project = workspace.nodes.find((node) => node.id === 'neural-canvas')!
    const task = workspace.nodes.find((node) => node.id === 'capture-idea')!
    expect(project).toMatchObject({ projectStatus: 'in-progress', techStack: ['React', 'TypeScript', 'Zustand', 'React Flow'] })
    expect(task).toMatchObject({ taskStatus: 'in-progress', projectId: 'neural-canvas', dueDate: '2026-10-23' })
    expect(workspace.architectureNotes.map((note) => note.type)).toEqual(['technical-decision', 'code'])

    const invalidTask = { ...task, projectId: 'missing-project' }
    expect(workspaceSchema.safeParse({ ...workspace, nodes: workspace.nodes.map((node) => node.id === task.id ? invalidTask : node) }).success).toBe(false)
  })

  it('migrates legacy note descriptions into searchable Markdown content', () => {
    const workspace = createInitialWorkspace()
    const note = workspace.nodes.find((node) => node.type === 'note')!
    const parsed = workspaceSchema.parse({
      ...workspace,
      nodes: workspace.nodes.map((node) => node.id === note.id ? { ...node, description: '# Migrated note content', markdownContent: undefined } : node),
    })
    expect(parsed.nodes.find((node) => node.id === note.id)?.markdownContent).toBe('# Migrated note content')
  })

  it('migrates older local workspaces to persisted default-view settings', () => {
    const workspace = createInitialWorkspace()
    const migrated = workspaceSchema.parse({ ...workspace, settings: undefined })
    expect(migrated.settings).toEqual({ defaultView: 'canvas' })

    const configured = workspaceSchema.parse({ ...workspace, settings: { defaultView: 'developer' } })
    expect(configured.settings.defaultView).toBe('developer')
    expect(workspaceSchema.safeParse({ ...workspace, settings: { defaultView: 'not-a-view' } }).success).toBe(false)
  })

  it('migrates legacy node and edge fields without weakening the canonical output', () => {
    const workspace = createInitialWorkspace()
    const legacyNodes = workspace.nodes.map(({ type, properties, favorite: _favorite, ...node }) => ({
      ...node,
      kind: type,
      customProperties: properties,
    }))
    const legacyEdges = workspace.edges.map(({ sourceId, targetId, relationType: _relationType, label: _label, createdAt: _createdAt, ...edge }) => ({
      ...edge,
      source: sourceId,
      target: targetId,
    }))

    const parsed = workspaceSchema.safeParse({ ...workspace, nodes: legacyNodes, edges: legacyEdges })
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data.nodes[0]).toMatchObject({ type: workspace.nodes[0]?.type, favorite: false, properties: [] })
    expect(parsed.data.nodes[0]).not.toHaveProperty('kind')
    expect(parsed.data.edges[0]).toMatchObject({
      sourceId: workspace.edges[0]?.sourceId,
      targetId: workspace.edges[0]?.targetId,
      relationType: 'related_to',
      label: 'Связано с',
      createdAt: workspace.updatedAt,
    })
    expect(parsed.data.edges[0]).not.toHaveProperty('source')
  })
})
