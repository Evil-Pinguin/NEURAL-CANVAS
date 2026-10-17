import { describe, expect, it } from 'vitest'
import { createInitialWorkspace } from '../domain/seed'
import { findConnectionInsight } from './insights'

describe('findConnectionInsight', () => {
  it('finds two unlinked thoughts that share a tag without using a remote service', () => {
    const result = findConnectionInsight(createInitialWorkspace())
    expect(result).not.toBeNull()
    expect(result?.sharedTag).toBe('архитектура')
    expect(result?.connected).toBe(false)
  })

  it('returns null when no unlinked shared-tag pair remains', () => {
    const workspace = createInitialWorkspace()
    const pair = workspace.nodes.filter((node) => node.id === 'knowledge-graph' || node.id === 'local-first')
    const linked = {
      ...workspace,
      nodes: pair,
      edges: [{
        id: 'e-architecture',
        sourceId: 'knowledge-graph',
        targetId: 'local-first',
        relationType: 'related_to' as const,
        label: 'Architecture connection',
        createdAt: workspace.updatedAt,
      }],
    }
    expect(findConnectionInsight(linked)).toBeNull()
  })
})
