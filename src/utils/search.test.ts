import { describe, expect, it } from 'vitest'
import { createInitialWorkspace } from '../domain/seed'
import { matchesNode } from './search'

describe('workspace search and filters', () => {
  const workspace = createInitialWorkspace()
  const node = workspace.nodes.find((item) => item.id === 'capture-idea')!

  it('matches node titles, notes, tags, kinds, and status labels case-insensitively', () => {
    expect(matchesNode(node, 'ЗАФИКСИРОВАТЬ', { kind: 'all', status: 'all' })).toBe(true)
    expect(matchesNode(node, 'взаимодействие', { kind: 'all', status: 'all' })).toBe(true)
    expect(matchesNode(node, 'задача', { kind: 'all', status: 'all' })).toBe(true)
    expect(matchesNode(node, 'работе', { kind: 'all', status: 'all' })).toBe(true)
    expect(matchesNode(node, 'not present', { kind: 'all', status: 'all' })).toBe(false)
  })

  it('searches project/task metadata and Markdown note bodies', () => {
    const project = workspace.nodes.find((item) => item.id === 'neural-canvas')!
    const note = { ...workspace.nodes.find((item) => item.id === 'learning-log')!, markdownContent: '## Offline architecture\nKeep encryption local.' }
    const task = { ...node, priority: 'critical' as const, dueDate: '2026-10-30' }

    expect(matchesNode(project, 'React Flow', { kind: 'all', status: 'all' })).toBe(true)
    expect(matchesNode(note, 'encryption', { kind: 'all', status: 'all' })).toBe(true)
    expect(matchesNode(task, 'критический', { kind: 'all', status: 'all' })).toBe(true)
    expect(matchesNode(task, '2026-10-30', { kind: 'all', status: 'all' })).toBe(true)
  })

  it('combines kind and status filters with text search', () => {
    expect(matchesNode(node, '', { kind: 'task', status: 'in-progress' })).toBe(true)
    expect(matchesNode(node, '', { kind: 'note', status: 'in-progress' })).toBe(false)
    expect(matchesNode(node, 'зафиксировать', { kind: 'task', status: 'planned' })).toBe(false)
  })
})
