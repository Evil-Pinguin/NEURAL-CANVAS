import { memo, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { Handle, Position, useReactFlow, type Node, type NodeProps } from '@xyflow/react'
import { ArrowUpRight, BookOpen, CheckCircle2, CheckSquare2, CircleHelp, FileText, FlaskConical, FolderKanban, Lightbulb, MoveDiagonal2, Network, Sparkles } from 'lucide-react'
import type { CanvasNodeData, NodeKind } from '../domain/model'
import { ideaFrameSizeLimits, defaultNodeColor, kindLabels, priorityLabels, statusLabels } from '../domain/model'
import { getNodeFrameSize } from '../utils/layout'

type FrameSize = { width: number; height: number }
type ResizeHandler = (id: string, frameSize: FrameSize) => void

export type FlowNode = Node<CanvasNodeData & {
  dimmed?: boolean
  related?: boolean
  unrelated?: boolean
  onFrameResize?: ResizeHandler
}, 'mindNode'>

const iconForKind: Record<NodeKind, typeof Lightbulb> = {
  idea: Lightbulb,
  concept: Network,
  knowledge: BookOpen,
  project: FolderKanban,
  task: CheckSquare2,
  note: FileText,
  resource: BookOpen,
  question: CircleHelp,
  hypothesis: FlaskConical,
  decision: CheckCircle2,
}

type ResizeDrag = {
  pointerId: number
  startX: number
  startY: number
  startWidth: number
  startHeight: number
  zoom: number
}

function clampFrameSize(width: number, height: number): FrameSize {
  return {
    width: Math.min(ideaFrameSizeLimits.maxWidth, Math.max(ideaFrameSizeLimits.minWidth, Math.round(width))),
    height: Math.min(ideaFrameSizeLimits.maxHeight, Math.max(ideaFrameSizeLimits.minHeight, Math.round(height))),
  }
}

function MindNode({ id, data, selected }: NodeProps<FlowNode>) {
  const Icon = iconForKind[data.type]
  const visibleTags = data.tags.slice(0, 2)
  const { getZoom } = useReactFlow<FlowNode>()
  const resizeHintId = useId()
  const resizeDragRef = useRef<ResizeDrag | null>(null)
  const [previewFrameSize, setPreviewFrameSize] = useState<FrameSize | null>(null)
  const canResize = data.type === 'idea' && Boolean(data.onFrameResize)
  const frameSize = previewFrameSize ?? data.frameSize
  const frameStyle = data.type === 'idea' && frameSize
    ? { width: `${frameSize.width}px`, height: `${frameSize.height}px` }
    : undefined
  const currentClass = `mind-node mind-node--${data.type} mind-node--color-${data.color ?? defaultNodeColor[data.type]}${selected ? ' is-selected' : ''}${data.related ? ' is-related' : ''}${data.unrelated ? ' is-unrelated' : ''}${data.dimmed ? ' is-dimmed' : ''}${previewFrameSize ? ' is-resizing' : ''}`

  const readCurrentFrameSize = (target: HTMLElement) => {
    const zoom = Math.max(getZoom(), 0.01)
    const measuredFrame = target.closest<HTMLElement>('.mind-node')?.getBoundingClientRect()
    const defaultFrame = getNodeFrameSize(data)
    return clampFrameSize(
      data.frameSize?.width ?? (measuredFrame?.width ? measuredFrame.width / zoom : defaultFrame.width),
      data.frameSize?.height ?? (measuredFrame?.height ? measuredFrame.height / zoom : defaultFrame.height),
    )
  }

  const sizeFromPointer = (drag: ResizeDrag, clientX: number, clientY: number) => clampFrameSize(
    drag.startWidth + (clientX - drag.startX) / drag.zoom,
    drag.startHeight + (clientY - drag.startY) / drag.zoom,
  )

  const stopResizeEvent = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
  }

  const handleResizePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    stopResizeEvent(event)
    if (event.button !== 0) return

    const currentSize = readCurrentFrameSize(event.currentTarget)
    const zoom = Math.max(getZoom(), 0.01)
    resizeDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: currentSize.width,
      startHeight: currentSize.height,
      zoom,
    }
    setPreviewFrameSize(currentSize)
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const handleResizePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    stopResizeEvent(event)
    const drag = resizeDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    setPreviewFrameSize(sizeFromPointer(drag, event.clientX, event.clientY))
  }

  const finishResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    stopResizeEvent(event)
    const drag = resizeDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    const nextSize = sizeFromPointer(drag, event.clientX, event.clientY)
    resizeDragRef.current = null
    setPreviewFrameSize(null)
    if (Math.abs(nextSize.width - drag.startWidth) >= 1 || Math.abs(nextSize.height - drag.startHeight) >= 1) {
      data.onFrameResize?.(id, nextSize)
    }
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId)
    }
  }

  const cancelResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    stopResizeEvent(event)
    const drag = resizeDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    resizeDragRef.current = null
    setPreviewFrameSize(null)
  }

  const handleResizeKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const step = event.shiftKey ? 40 : 20
    const currentSize = readCurrentFrameSize(event.currentTarget)
    let width = currentSize.width
    let height = currentSize.height

    switch (event.key) {
      case 'ArrowLeft': width -= step; break
      case 'ArrowRight': width += step; break
      case 'ArrowUp': height -= step; break
      case 'ArrowDown': height += step; break
      case 'Enter':
      case ' ':
        width += step
        height += step
        break
      default: return
    }

    event.preventDefault()
    event.stopPropagation()
    const nextSize = clampFrameSize(width, height)
    if (nextSize.width !== currentSize.width || nextSize.height !== currentSize.height) {
      data.onFrameResize?.(id, nextSize)
    }
  }

  const handleLostPointerCapture = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!resizeDragRef.current || resizeDragRef.current.pointerId !== event.pointerId) return
    resizeDragRef.current = null
    setPreviewFrameSize(null)
  }

  return (
    <article className={currentClass} style={frameStyle}>
      <Handle className="node-handle" type="target" position={Position.Left} id="target-left" />
      <Handle className="node-handle" type="target" position={Position.Top} id="target-top" />
      <div className="mind-node__topline">
        <span className="mind-node__kind">
          <Icon size={13} strokeWidth={1.8} />
          {kindLabels[data.type]}
        </span>
        <span className="mind-node__status">
          <span className={`mind-node__state state-${data.status}`} aria-hidden="true" />
          <span>{statusLabels[data.status]}</span>
        </span>
      </div>
      <div className="mind-node__title-row">
        <h3>{data.title}</h3>
        <ArrowUpRight className="mind-node__open" size={13} />
      </div>
      {data.description && <p className="mind-node__description">{data.description}</p>}
      {visibleTags.length > 0 && (
        <div className="mind-node__tags">
          {visibleTags.map((tag) => <span key={tag}>{tag}</span>)}
          {data.tags.length > visibleTags.length && <span className="tag-more">+{data.tags.length - visibleTags.length}</span>}
        </div>
      )}
      {data.type === 'task' && (
        <>
          <span className="mind-node__priority" aria-hidden="true" />
          <span className="mind-node__priority-label">
            <span className={`mind-node__priority-marker priority-${data.priority}`} aria-hidden="true" />
            Приоритет: {priorityLabels[data.priority]}
          </span>
        </>
      )}
      <Handle className="node-handle" type="source" position={Position.Right} id="source-right" />
      <Handle className="node-handle" type="source" position={Position.Bottom} id="source-bottom" />
      {canResize && (
        <>
          <span className="visually-hidden" id={resizeHintId}>
            Потяните ручку, используйте клавиши со стрелками или нажмите Enter/пробел, чтобы увеличить рамку. Удерживайте Shift для шага в 40 пикселей.
          </span>
          <button
            type="button"
            className="mind-node__resize-handle nodrag nopan"
            aria-label={`Изменить размер рамки идеи «${data.title}»`}
            aria-describedby={resizeHintId}
            aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Enter Space"
            title="Потяните, чтобы изменить размер; используйте стрелки, Enter или пробел."
            onPointerDown={handleResizePointerDown}
            onPointerMove={handleResizePointerMove}
            onPointerUp={finishResize}
            onPointerCancel={cancelResize}
            onLostPointerCapture={handleLostPointerCapture}
            onKeyDown={handleResizeKeyDown}
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            onContextMenu={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
          >
            <MoveDiagonal2 size={14} strokeWidth={2} aria-hidden="true" />
          </button>
        </>
      )}
      <span className="mind-node__shine" aria-hidden="true"><Sparkles size={11} /></span>
    </article>
  )
}

export default memo(MindNode)
