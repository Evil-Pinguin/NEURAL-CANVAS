import { memo } from 'react'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { ArrowUpRight, BookOpen, CheckCircle2, CheckSquare2, CircleHelp, FileText, FlaskConical, FolderKanban, Lightbulb, Network, Sparkles } from 'lucide-react'
import type { CanvasNodeData, NodeKind } from '../domain/model'
import { defaultNodeColor, kindLabels, priorityLabels, statusLabels } from '../domain/model'

export type FlowNode = Node<CanvasNodeData & { dimmed?: boolean; related?: boolean; unrelated?: boolean }, 'mindNode'>

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

function MindNode({ data, selected }: NodeProps<FlowNode>) {
  const Icon = iconForKind[data.type]
  const visibleTags = data.tags.slice(0, 2)

  return (
    <article className={`mind-node mind-node--${data.type} mind-node--color-${data.color ?? defaultNodeColor[data.type]}${selected ? ' is-selected' : ''}${data.related ? ' is-related' : ''}${data.unrelated ? ' is-unrelated' : ''}${data.dimmed ? ' is-dimmed' : ''}`}>
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
      <span className="mind-node__shine" aria-hidden="true"><Sparkles size={11} /></span>
    </article>
  )
}

export default memo(MindNode)
