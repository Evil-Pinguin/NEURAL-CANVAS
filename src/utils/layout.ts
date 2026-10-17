import type { CanvasNodeData, NodeKind } from '../domain/model'

type FrameSize = { width: number; height: number }

const ideaFrame: FrameSize = { width: 280, height: 156 }
const standardFrame: FrameSize = { width: 248, height: 145 }
const frameGap = 20
const searchStepX = 320
const searchStepY = 180

/** Approximate card bounds with room for text and a small gap around each frame. */
export function getNodeFrameSize(node: NodeKind | Pick<CanvasNodeData, 'type' | 'frameSize'>): FrameSize {
  const type = typeof node === 'string' ? node : node.type
  const defaultFrame = type === 'idea' ? ideaFrame : standardFrame
  if (typeof node === 'string' || type !== 'idea' || !node.frameSize) return defaultFrame
  return { width: node.frameSize.width, height: node.frameSize.height }
}

/** Pick a nearby open graph position, reserving each saved card's actual footprint. */
export function findClearPosition(
  nodes: CanvasNodeData[],
  center: { x: number; y: number },
  kind: NodeKind | Pick<CanvasNodeData, 'type' | 'frameSize'> = 'idea',
) {
  const candidateFrame = getNodeFrameSize(kind)
  const clearOfNodes = (position: { x: number; y: number }) => nodes.every((node) => {
    const occupiedFrame = getNodeFrameSize(node)
    return position.x + candidateFrame.width + frameGap <= node.position.x
      || node.position.x + occupiedFrame.width + frameGap <= position.x
      || position.y + candidateFrame.height + frameGap <= node.position.y
      || node.position.y + occupiedFrame.height + frameGap <= position.y
  })

  for (let radius = 0; radius <= 10; radius += 1) {
    for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
      for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
        if (Math.max(Math.abs(offsetX), Math.abs(offsetY)) !== radius) continue
        const candidate = { x: center.x + offsetX * searchStepX, y: center.y + offsetY * searchStepY }
        if (clearOfNodes(candidate)) return candidate
      }
    }
  }

  const rightmostNode = nodes.reduce((maximum, node) => Math.max(maximum, node.position.x + getNodeFrameSize(node).width), center.x)
  return { x: rightmostNode + frameGap, y: center.y }
}
