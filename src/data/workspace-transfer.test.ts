import { describe, expect, it } from 'vitest'
import { createInitialWorkspace } from '../domain/seed'
import { workspaceSchema } from '../domain/model'
import {
  createWorkspaceExport,
  mergeWorkspaces,
  parseWorkspaceImport,
} from './workspace-transfer'

describe('versioned workspace backups', () => {
  it('exports and validates a versioned full-workspace envelope', () => {
    const workspace = createInitialWorkspace()
    workspace.settings.defaultView = 'developer'
    workspace.nodes[0]!.favorite = true
    workspace.nodes.find((node) => node.id === 'systems-thinking')!.frameSize = { width: 520, height: 320 }
    const backup = createWorkspaceExport(workspace, '2026-10-17T10:00:00.000Z')

    expect(backup).toMatchObject({
      format: 'neural-canvas-workspace',
      version: 2,
      exportedAt: '2026-10-17T10:00:00.000Z',
      workspace: { settings: { defaultView: 'developer' } },
    })
    const parsed = parseWorkspaceImport(JSON.parse(JSON.stringify(backup)))
    expect(parsed.legacy).toBe(false)
    expect(parsed.workspace).toEqual(workspaceSchema.parse(workspace))
  })

  it('imports version-1 backups created before idea frame sizes were added', () => {
    const workspace = createInitialWorkspace()
    const imported = parseWorkspaceImport({
      format: 'neural-canvas-workspace',
      version: 1,
      exportedAt: '2026-10-17T10:00:00.000Z',
      workspace,
    })

    expect(imported.legacy).toBe(false)
    expect(imported.workspace).toEqual(workspaceSchema.parse(workspace))
  })

  it('accepts legacy unversioned JSON and applies model defaults', () => {
    const workspace = createInitialWorkspace()
    const imported = parseWorkspaceImport({ ...workspace, settings: undefined })
    expect(imported.legacy).toBe(true)
    expect(imported.workspace.settings).toEqual({ defaultView: 'canvas' })
  })

  it('explains unsupported backup versions and rejects broken references', () => {
    const workspace = createInitialWorkspace()
    expect(() => parseWorkspaceImport({ format: 'neural-canvas-workspace', version: 99, workspace }))
      .toThrow('Версия резервной копии 99 не поддерживается')
    expect(() => parseWorkspaceImport({ format: 'another-app', version: 1, workspace }))
      .toThrow('Этот файл не является резервной копией рабочего пространства Нейро-холст')

    const invalid = { ...workspace, edges: [...workspace.edges, {
      id: 'dangling-edge', sourceId: 'missing-node', targetId: 'neural-canvas',
      relationType: 'references', label: 'Broken reference', createdAt: workspace.updatedAt,
    }] }
    expect(() => parseWorkspaceImport(invalid)).toThrow(/исходному и целевому узлам/)
  })
})

describe('non-destructive workspace merge', () => {
  it('keeps existing data and remaps conflicting graph, task, edge, and note references', () => {
    const current = createInitialWorkspace()
    const incoming = createInitialWorkspace()
    incoming.name = 'Imported copy'
    incoming.nodes = incoming.nodes.map((node) => {
      if (node.id === 'neural-canvas') return { ...node, title: 'Imported Neural Canvas' }
      if (node.id === 'capture-idea') return { ...node, title: 'Imported capture task' }
      return node
    })

    const { workspace: merged, stats } = mergeWorkspaces(current, incoming, '2026-10-17T12:00:00.000Z')
    const importedProject = merged.nodes.find((node) => node.title === 'Imported Neural Canvas')
    const importedTask = merged.nodes.find((node) => node.title === 'Imported capture task')
    const importedArchitectureNote = merged.architectureNotes.find((note) => note.projectId === importedProject?.id)

    expect(merged.id).toBe(current.id)
    expect(merged.name).toBe(current.name)
    expect(merged.nodes).toHaveLength(current.nodes.length + 3)
    expect(importedProject?.id).not.toBe('neural-canvas')
    expect(importedTask?.projectId).toBe(importedProject?.id)
    expect(importedArchitectureNote).toBeDefined()
    expect(merged.edges.some((edge) => edge.sourceId === importedProject?.id && edge.targetId === importedTask?.id)).toBe(true)
    expect(workspaceSchema.safeParse(merged).success).toBe(true)
    expect(stats.addedNodes).toBe(3)
    expect(stats.addedArchitectureNotes).toBe(2)
    expect(stats.addedEdges).toBeGreaterThan(0)

    const repeatedMerge = mergeWorkspaces(merged, incoming)
    expect(repeatedMerge.workspace.nodes).toHaveLength(merged.nodes.length)
    expect(repeatedMerge.workspace.edges).toHaveLength(merged.edges.length)
    expect(repeatedMerge.workspace.architectureNotes).toHaveLength(merged.architectureNotes.length)
    expect(repeatedMerge.stats.addedNodes).toBe(0)
    expect(repeatedMerge.stats.addedEdges).toBe(0)
    expect(repeatedMerge.stats.addedArchitectureNotes).toBe(0)
  })

  it('skips imported dependency links that would create a cycle', () => {
    const seed = createInitialWorkspace()
    const current = workspaceSchema.parse({
      ...seed,
      edges: [{
        id: 'current-dependency', sourceId: 'systems-thinking', targetId: 'knowledge-graph',
        relationType: 'depends_on', label: 'Current dependency', createdAt: seed.updatedAt,
      }],
    })
    const incoming = workspaceSchema.parse({
      ...seed,
      edges: [{
        id: 'incoming-dependency', sourceId: 'knowledge-graph', targetId: 'systems-thinking',
        relationType: 'depends_on', label: 'Reverse dependency', createdAt: seed.updatedAt,
      }],
    })

    const result = mergeWorkspaces(current, incoming)
    expect(result.workspace.edges).toHaveLength(1)
    expect(result.stats.skippedCyclicEdges).toBe(1)
    expect(workspaceSchema.safeParse(result.workspace).success).toBe(true)
  })
})
