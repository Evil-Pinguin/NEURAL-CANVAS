import { describe, expect, it } from 'vitest'
import { createInitialWorkspace } from '../domain/seed'
import { findClearPosition, getNodeFrameSize } from './layout'

describe('findClearPosition', () => {
  it('leaves enough room for a larger idea card beside the seeded graph', () => {
    const nodes = createInitialWorkspace().nodes
    const kind = 'idea'
    const position = findClearPosition(nodes, { x: 360, y: 245 }, kind)
    const candidateFrame = getNodeFrameSize(kind)
    const overlaps = nodes.some((node) => {
      const occupiedFrame = getNodeFrameSize(node.type)
      return position.x < node.position.x + occupiedFrame.width
        && position.x + candidateFrame.width > node.position.x
        && position.y < node.position.y + occupiedFrame.height
        && position.y + candidateFrame.height > node.position.y
    })

    expect(overlaps).toBe(false)
  })

  it('reserves a visibly larger footprint for ideas than for other objects', () => {
    expect(getNodeFrameSize('idea').width).toBeGreaterThan(getNodeFrameSize('concept').width)
    expect(getNodeFrameSize('idea').height).toBeGreaterThan(getNodeFrameSize('concept').height)
  })

  it('keeps the starter workspace clear of overlaps with the larger idea frames', () => {
    const nodes = createInitialWorkspace().nodes
    const overlaps = nodes.some((node, index) => nodes.slice(index + 1).some((other) => {
      const nodeFrame = getNodeFrameSize(node.type)
      const otherFrame = getNodeFrameSize(other.type)
      return node.position.x < other.position.x + otherFrame.width
        && node.position.x + nodeFrame.width > other.position.x
        && node.position.y < other.position.y + otherFrame.height
        && node.position.y + nodeFrame.height > other.position.y
    }))

    expect(overlaps).toBe(false)
  })
})
