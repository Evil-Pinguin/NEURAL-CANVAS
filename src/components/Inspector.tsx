import { useEffect, useRef, useState, type CSSProperties, type FocusEvent, type FormEvent, type KeyboardEvent } from 'react'
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  CirclePlus,
  Copy,
  Link2,
  MousePointer2,
  PanelRightClose,
  Pencil,
  Plus,
  Sparkles,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import type { CanvasEdgeData, CanvasNodeData, CustomProperty, NodeColor, NodeKind, NodePriority, NodeStatus, Workspace } from '../domain/model'
import { defaultRelationLabels, getNodeContent, getRelationCaption, kindLabels, newNodeTitleLabels, nodeColorHex, nodeColorLabels, nodeColors, priorityLabels, relationTypes, relationTypeLabels, statusLabels, type RelationType } from '../domain/model'
import { useWorkspaceStore } from '../store/workspace-store'
import { countConnectedNodes, findConnectionInsight } from '../utils/insights'
import { findClearPosition } from '../utils/layout'
import { formatRussianDate } from '../utils/locale'

type InspectorProps = {
  workspace: Workspace
  selectedNodeId: string | null
  collapsed: boolean
  onToggleCollapsed: () => void
  onSelectNode: (id: string | null) => void
  onCreateNode: () => void
}

type RelatedConnection = { edge: CanvasEdgeData; object: CanvasNodeData }

const statuses: NodeStatus[] = ['active', 'in-progress', 'planned', 'done', 'archived']
const priorities: NodePriority[] = ['low', 'medium', 'high', 'critical']
const kinds: NodeKind[] = ['idea', 'concept', 'knowledge', 'project', 'task', 'note', 'resource', 'question', 'hypothesis', 'decision']

function makeId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function formatDate(value: string) {
  return formatRussianDate(value, { dateStyle: 'medium', timeStyle: 'short' })
}

function toDateTimeInput(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function fromDateTimeInput(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function getRelatedConnections(workspace: Workspace, node: CanvasNodeData, direction: 'incoming' | 'outgoing'): RelatedConnection[] {
  const edges = workspace.edges.filter((edge) => direction === 'incoming' ? edge.targetId === node.id : edge.sourceId === node.id)
  return edges.flatMap((edge) => {
    const otherId = direction === 'incoming' ? edge.sourceId : edge.targetId
    const object = workspace.nodes.find((item) => item.id === otherId)
    return object && !object.deletedAt ? [{ edge, object }] : []
  })
}

export default function Inspector({ workspace, selectedNodeId, collapsed, onToggleCollapsed, onSelectNode, onCreateNode }: InspectorProps) {
  const node = workspace.nodes.find((item) => item.id === selectedNodeId && !item.deletedAt)
  const updateNode = useWorkspaceStore((state) => state.updateNode)
  const trashNode = useWorkspaceStore((state) => state.trashNode)
  const duplicateNode = useWorkspaceStore((state) => state.duplicateNode)
  const addEdge = useWorkspaceStore((state) => state.addEdge)
  const updateEdgeLabel = useWorkspaceStore((state) => state.updateEdgeLabel)
  const deleteEdge = useWorkspaceStore((state) => state.deleteEdge)
  const toggleFavorite = useWorkspaceStore((state) => state.toggleFavorite)
  const saveStatus = useWorkspaceStore((state) => state.saveStatus)
  const insight = findConnectionInsight(workspace)
  const [tagDraft, setTagDraft] = useState('')
  const [tagNodeId, setTagNodeId] = useState<string | null>(null)
  const [titleDraft, setTitleDraft] = useState(node?.title ?? '')
  const [propertyName, setPropertyName] = useState('')
  const [propertyValue, setPropertyValue] = useState('')
  const [connectionDirection, setConnectionDirection] = useState<'incoming' | 'outgoing'>('outgoing')
  const [connectionTargetId, setConnectionTargetId] = useState('')
  const [connectionRelationType, setConnectionRelationType] = useState<RelationType>('related_to')
  const [connectionLabel, setConnectionLabel] = useState(defaultRelationLabels.related_to)

  useEffect(() => { setTitleDraft(node?.title ?? '') }, [node?.id, node?.title])
  useEffect(() => {
    setPropertyName('')
    setPropertyValue('')
  }, [node?.id])
  useEffect(() => { setConnectionTargetId('') }, [node?.id, connectionDirection])

  const incoming = node ? getRelatedConnections(workspace, node, 'incoming') : []
  const outgoing = node ? getRelatedConnections(workspace, node, 'outgoing') : []
  const relatedCount = new Set([...incoming, ...outgoing].map((connection) => connection.object.id)).size
  const availableTargets = node ? workspace.nodes.filter((target) => {
    if (target.id === node.id || target.deletedAt) return false
    return !workspace.edges.some((edge) => connectionDirection === 'outgoing'
      ? edge.sourceId === node.id && edge.targetId === target.id
      : edge.sourceId === target.id && edge.targetId === node.id)
  }) : []
  const currentColor = node ? node.color : 'violet'

  const addTag = (event?: FormEvent | KeyboardEvent) => {
    event?.preventDefault()
    if (!node) return
    const nextTag = tagDraft.trim().replace(/^#/, '').slice(0, 48)
    if (!nextTag || node.tags.length >= 20 || node.tags.some((tag) => tag.toLowerCase() === nextTag.toLowerCase())) {
      setTagDraft('')
      return
    }
    updateNode(node.id, { tags: [...node.tags, nextTag] })
    setTagDraft('')
  }

  const commitPropertyDraft = () => {
    if (!node || (node.properties?.length ?? 0) >= 30) return
    const rawName = propertyName.trim().slice(0, 48)
    const value = propertyValue.slice(0, 1200)
    if (!rawName && !value.trim()) return
    const name = rawName || 'Заметка'
    const properties = node.properties ?? []
    updateNode(node.id, {
      properties: [...properties, { id: makeId(), name, value }],
    })
    setPropertyName('')
    setPropertyValue('')
  }

  const addProperty = (event: FormEvent) => {
    event.preventDefault()
    commitPropertyDraft()
  }

  const commitPropertyWhenLeaving = (event: FocusEvent<HTMLFormElement>) => {
    const nextTarget = event.relatedTarget
    if (nextTarget && event.currentTarget.contains(nextTarget as Node)) return
    commitPropertyDraft()
  }

  const updateProperty = (id: string, changes: Partial<Pick<CustomProperty, 'name' | 'value'>>) => {
    if (!node) return
    updateNode(node.id, {
      properties: (node.properties ?? []).map((property) => property.id === id ? { ...property, ...changes } : property),
    })
  }

  const removeProperty = (id: string) => {
    if (!node) return
    updateNode(node.id, { properties: (node.properties ?? []).filter((property) => property.id !== id) })
  }

  const handleAddConnection = (event: FormEvent) => {
    event.preventDefault()
    if (!node) return
    const related = availableTargets.find((target) => target.id === connectionTargetId)
    if (!related) return
    const label = connectionLabel.trim() || defaultRelationLabels[connectionRelationType]
    if (connectionDirection === 'outgoing') addEdge(node.id, related.id, connectionRelationType, label)
    else addEdge(related.id, node.id, connectionRelationType, label)
    setConnectionTargetId('')
  }

  const handleDuplicate = () => {
    if (!node) return
    const position = findClearPosition(
      workspace.nodes.filter((item) => !item.deletedAt),
      { x: node.position.x + 250, y: node.position.y },
      node.type,
    )
    const duplicate = duplicateNode(node.id, position)
    if (duplicate) onSelectNode(duplicate.id)
  }

  const handleDelete = () => {
    if (!node) return
    trashNode(node.id)
  }

  if (collapsed) return null

  if (!node) {
    const liveNodes = workspace.nodes.filter((item) => !item.deletedAt)
    const projectCount = liveNodes.filter((item) => item.type === 'project').length
    const taskCount = liveNodes.filter((item) => item.type === 'task' && item.status !== 'done' && item.status !== 'archived').length
    const liveWorkspace = {
      ...workspace,
      nodes: liveNodes,
      edges: workspace.edges.filter((edge) => liveNodes.some((nodeItem) => nodeItem.id === edge.sourceId) && liveNodes.some((nodeItem) => nodeItem.id === edge.targetId)),
    }
    const linkedPercent = liveNodes.length ? Math.round((countConnectedNodes(liveWorkspace) / liveNodes.length) * 100) : 0
    const recent = [...liveNodes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3)

    return (
      <aside className="inspector" aria-label="Сведения о рабочем пространстве">
        <div className="inspector__header">
          <div><span className="eyebrow">СОСТОЯНИЕ ПРОСТРАНСТВА</span><h2>Обзор</h2></div>
          <div className="inspector__header-actions">
            <span className="pulse-live"><i /> АКТИВНО</span>
            <button className="icon-button" aria-label="Свернуть панель сведений" title="Свернуть панель сведений" onClick={onToggleCollapsed}><PanelRightClose size={16} /></button>
          </div>
        </div>
        <div className="inspector-empty-state" role="status">
          <span className="inspector-empty-state__icon"><MousePointer2 size={17} /></span>
          <div><h3>Объект не выбран</h3><p>Выберите объект на холсте, чтобы посмотреть и изменить его данные.</p></div>
        </div>
        <div className="overview-greeting">
          <span className="overview-orbit"><Sparkles size={17} /></span>
          <div><h3>Ваши идеи связаны.</h3><p>Проследите, как идеи превращаются в реальные задачи.</p></div>
        </div>

        {insight && (
          <section className="insight-card" aria-label="Подсказка о связи">
            <div className="insight-card__top"><span className="insight-spark"><Sparkles size={13} /></span><span>ВОЗМОЖНАЯ СВЯЗЬ</span><span className="local-badge">ЛОКАЛЬНО</span></div>
            <p><strong>{insight.first.title}</strong> и <strong>{insight.second.title}</strong>{insight.sharedTag ? <> имеют общий тег <em>#{insight.sharedTag}</em></> : <> могут быть связаны в графе</>}.</p>
            <div className="insight-card__nodes">
              <button onClick={() => onSelectNode(insight.first.id)}>{insight.first.title}<ArrowUpRight size={12} /></button>
              <button onClick={() => onSelectNode(insight.second.id)}>{insight.second.title}<ArrowDownRight size={12} /></button>
            </div>
            <small>Предложение основано на общих тегах. Связь не будет добавлена без вашего действия.</small>
          </section>
        )}

        <section className="stats-grid" aria-label="Статистика рабочего пространства">
          <div className="stat-tile stat-tile--violet"><span>УЗЛЫ ЗНАНИЙ</span><strong>{liveNodes.length.toString().padStart(2, '0')}</strong><small>связано: {linkedPercent}%</small></div>
          <div className="stat-tile stat-tile--cyan"><span>СВЯЗИ</span><strong>{liveWorkspace.edges.length.toString().padStart(2, '0')}</strong><small>отношений в графе</small></div>
          <div className="stat-tile"><span>ПРОЕКТЫ</span><strong>{projectCount.toString().padStart(2, '0')}</strong><small>в рабочем пространстве</small></div>
          <div className="stat-tile"><span>ОТКРЫТЫЕ ЗАДАЧИ</span><strong>{taskCount.toString().padStart(2, '0')}</strong><small>можно продолжить</small></div>
        </section>

        <section className="recent-section">
          <div className="section-heading"><h3>Недавно в графе</h3><span>Последние изменения</span></div>
          <div className="recent-list">
            {recent.map((item) => (
              <button className="recent-row" key={item.id} onClick={() => onSelectNode(item.id)}>
                <span className={`recent-dot dot-${item.type}`} />
                <span className="recent-row__copy"><strong>{item.title}</strong><small>{kindLabels[item.type]}</small></span>
                <ChevronRight size={14} />
              </button>
            ))}
          </div>
        </section>

        <div className="inspector__bottom-action">
          <button className="button-secondary button-full" onClick={onCreateNode}><CirclePlus size={15} /> Записать мысль</button>
          <p>Найти объект: <span className="key-chip">⌘ / Ctrl</span> + <span className="key-chip">K / Л</span></p>
        </div>
      </aside>
    )
  }

  const properties = node.properties ?? []
  const canDuplicate = workspace.nodes.length < 2000

  return (
    <aside className="inspector inspector--detail" aria-label={`Сведения об объекте «${node.title}»`}>
      <div className="inspector__header inspector__header--detail">
        <div><span className="eyebrow">ДАННЫЕ ОБЪЕКТА</span><h2>Настройки объекта</h2></div>
        <div className="inspector__header-actions">
          <button className="icon-button" aria-label={`Создать копию объекта «${node.title}»`} title="Создать копию объекта" disabled={!canDuplicate} onClick={handleDuplicate}><Copy size={14} /></button>
          <button className={`favorite-node-button${node.favorite ? ' is-favorite' : ''}`} aria-label={node.favorite ? `Убрать «${node.title}» из избранного` : `Добавить «${node.title}» в избранное`} aria-pressed={Boolean(node.favorite)} onClick={() => toggleFavorite(node.id)}><Star size={15} fill={node.favorite ? 'currentColor' : 'none'} /></button>
          <button className="icon-button" aria-label="Свернуть панель сведений" title="Свернуть панель сведений" onClick={onToggleCollapsed}><PanelRightClose size={16} /></button>
          <button className="icon-button" aria-label="Закрыть сведения об объекте" title="Снять выделение" onClick={() => onSelectNode(null)}><X size={16} /></button>
        </div>
      </div>

      <div className={`detail-kind detail-kind--${node.type}`}>
        <span className="detail-kind__icon"><KindGlyph kind={node.type} /></span>
        <label>
          <span>ТИП</span>
          <select aria-label="Тип объекта" value={node.type} onChange={(event) => updateNode(node.id, { type: event.target.value as NodeKind })}>
            {kinds.map((kind) => <option key={kind} value={kind}>{kindLabels[kind]}</option>)}
          </select>
        </label>
        <span className="detail-kind__status"><i className={`state-${node.status}`} /></span>
      </div>

      <label className="field-label" htmlFor="node-title">НАЗВАНИЕ</label>
      <input
        id="node-title"
        className="text-field title-field"
        value={titleDraft}
        maxLength={180}
        onChange={(event) => {
          setTitleDraft(event.target.value)
          if (event.target.value.trim()) updateNode(node.id, { title: event.target.value })
        }}
        onBlur={() => {
          const title = titleDraft.trim() || newNodeTitleLabels[node.type]
          setTitleDraft(title)
          if (title !== node.title) updateNode(node.id, { title })
        }}
      />

      <label className="field-label field-label--spaced" htmlFor="node-description">{node.type === 'note' ? 'СОДЕРЖИМОЕ ЗАМЕТКИ' : 'ОПИСАНИЕ'}</label>
      <textarea
        id="node-description"
        className="text-field notes-field"
        value={getNodeContent(node)}
        maxLength={node.type === 'note' ? 100000 : 5000}
        placeholder={node.type === 'note' ? 'Введите текст заметки в формате Markdown…' : 'Добавьте пояснение, вопрос или следующий шаг…'}
        onChange={(event) => updateNode(node.id, node.type === 'note' ? { markdownContent: event.target.value } : { description: event.target.value })}
      />
      <span className="field-helper">{node.type === 'note' ? 'Заметки Markdown сохраняются на устройстве автоматически. Для форматирования откройте раздел «Заметки».' : 'Добавьте пояснение к объекту. Изменения сохраняются автоматически.'}</span>

      <div className="field-grid">
        <label className="select-field"><span>СТАТУС</span><select value={node.status} onChange={(event) => updateNode(node.id, { status: event.target.value as NodeStatus })}>{statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
        <label className="select-field"><span>ПРИОРИТЕТ</span><select value={node.priority} onChange={(event) => updateNode(node.id, { priority: event.target.value as NodePriority })}>{priorities.map((priority) => <option key={priority} value={priority}>{priorityLabels[priority]}</option>)}</select></label>
      </div>

      <section className="color-section" aria-label="Цвет объекта">
        <div className="section-heading"><h3>Цвет</h3><span>{nodeColorLabels[currentColor]}</span></div>
        <div className="color-options" role="group" aria-label="Выбрать цвет объекта">
          {nodeColors.map((color: NodeColor) => (
            <button
              key={color}
              className={`color-swatch${currentColor === color ? ' is-selected' : ''}`}
              type="button"
              style={{ '--swatch-color': nodeColorHex[color] } as CSSProperties}
              aria-label={`Выбрать цвет: ${nodeColorLabels[color]}`}
              aria-pressed={currentColor === color}
              title={nodeColorLabels[color]}
              onClick={() => updateNode(node.id, { color })}
            />
          ))}
        </div>
      </section>

      <section className="tag-editor">
        <div className="section-heading"><label className="field-label">ТЕГИ</label><span>{node.tags.length}/20</span></div>
        <div className="tag-list">
          {node.tags.map((tag) => (
            <span className="editable-tag" key={tag}>{tag}<button aria-label={`Удалить тег «${tag}»`} onClick={() => updateNode(node.id, { tags: node.tags.filter((value) => value !== tag) })}><X size={11} /></button></span>
          ))}
          {node.tags.length === 0 && <span className="no-tags">Тегов пока нет</span>}
        </div>
        <form className="tag-input-row" onSubmit={(event) => addTag(event)}>
          <Plus size={14} />
          <input
            aria-label="Добавить тег"
            placeholder="Введите тег и нажмите Enter"
            value={tagNodeId === node.id ? tagDraft : ''}
            onFocus={() => setTagNodeId(node.id)}
            onChange={(event) => { setTagNodeId(node.id); setTagDraft(event.target.value) }}
            onBlur={() => { if (tagDraft.trim()) addTag() }}
            onKeyDown={(event) => { if (event.key === 'Enter') addTag(event) }}
          />
        </form>
      </section>

      <section className="custom-properties-section">
        <div className="section-heading"><h3>Дополнительные свойства</h3><span>{properties.length}/30</span></div>
        {properties.length > 0 ? (
          <div className="custom-property-list">
            {properties.map((property) => (
              <CustomPropertyEditor
                key={property.id}
                property={property}
                onUpdate={(changes) => updateProperty(property.id, changes)}
                onRemove={() => removeProperty(property.id)}
              />
            ))}
          </div>
        ) : <p className="custom-properties-empty">Добавьте дополнительные сведения об этом объекте.</p>}
        <form className="custom-property-form" onSubmit={addProperty} onBlurCapture={commitPropertyWhenLeaving}>
          <input
            aria-label="Название свойства"
            placeholder="Название свойства"
            maxLength={48}
            value={propertyName}
            onChange={(event) => setPropertyName(event.target.value)}
            disabled={properties.length >= 30}
          />
          <textarea
            aria-label="Значение свойства"
            placeholder="Значение"
            maxLength={1200}
            rows={2}
            value={propertyValue}
            onChange={(event) => setPropertyValue(event.target.value)}
            disabled={properties.length >= 30}
          />
          <button className="button-secondary" type="submit" disabled={(!propertyName.trim() && !propertyValue.trim()) || properties.length >= 30}><Plus size={13} /> Добавить свойство</button>
        </form>
      </section>

      <section className="connections-section">
        <div className="section-heading"><h3><Link2 size={14} /> Связанные объекты</h3><span>{relatedCount}</span></div>
        <ConnectionGroup direction="outgoing" connections={outgoing} onSelectNode={onSelectNode} onUpdateConnectionLabel={updateEdgeLabel} onDeleteConnection={deleteEdge} />
        <ConnectionGroup direction="incoming" connections={incoming} onSelectNode={onSelectNode} onUpdateConnectionLabel={updateEdgeLabel} onDeleteConnection={deleteEdge} />
        {relatedCount === 0 && <p className="empty-connections">Связей пока нет. Добавьте связь здесь или соедините объекты на холсте.</p>}
        <form className="inspector-link-form" onSubmit={handleAddConnection}>
          <label>
            <span>Направление</span>
            <select aria-label="Направление связи" value={connectionDirection} onChange={(event) => setConnectionDirection(event.target.value as 'incoming' | 'outgoing')}>
              <option value="outgoing">Исходящая от этого объекта</option>
              <option value="incoming">Входящая к этому объекту</option>
            </select>
          </label>
          <label>
            <span>Тип отношения</span>
            <select
              aria-label="Тип отношения"
              value={connectionRelationType}
              onChange={(event) => {
                const relationType = event.target.value as RelationType
                setConnectionRelationType(relationType)
                setConnectionLabel(defaultRelationLabels[relationType])
              }}
            >
              {relationTypes.map((relationType) => <option key={relationType} value={relationType}>{relationTypeLabels[relationType]}</option>)}
            </select>
          </label>
          <label>
            <span>Подпись связи</span>
            <input aria-label="Подпись связи" value={connectionLabel} maxLength={80} onChange={(event) => setConnectionLabel(event.target.value)} />
          </label>
          <label>
            <span>Объект</span>
            <select aria-label="Объект для связи" value={connectionTargetId} onChange={(event) => setConnectionTargetId(event.target.value)}>
              <option value="">Выберите объект</option>
              {availableTargets.map((target) => <option key={target.id} value={target.id}>{target.title}</option>)}
            </select>
          </label>
          <button className="button-secondary" type="submit" disabled={!connectionTargetId || !availableTargets.some((target) => target.id === connectionTargetId)}><Link2 size={13} /> Добавить связь</button>
        </form>
        <p className="connection-hint">Связи не создаются автоматически: для этого нужно выполнить явное действие.</p>
      </section>

      <section className="date-section" aria-label="Даты объекта">
        <div className="section-heading"><h3><CalendarDays size={14} /> Даты</h3><span>Местное время</span></div>
        <label className="date-field">
          <span>Создано</span>
          <input
            aria-label="Дата создания"
            type="datetime-local"
            value={toDateTimeInput(node.createdAt)}
            onChange={(event) => {
              const createdAt = fromDateTimeInput(event.target.value)
              if (createdAt) updateNode(node.id, { createdAt })
            }}
          />
          <small><time dateTime={node.createdAt}>{formatDate(node.createdAt)}</time></small>
        </label>
        <label className="date-field">
          <span>Изменено</span>
          <input
            aria-label="Дата изменения"
            type="datetime-local"
            value={toDateTimeInput(node.updatedAt)}
            onChange={(event) => {
              const updatedAt = fromDateTimeInput(event.target.value)
              if (updatedAt) updateNode(node.id, { updatedAt })
            }}
          />
          <small><time dateTime={node.updatedAt}>{formatDate(node.updatedAt)}</time></small>
        </label>
      </section>

      <div className="detail-footer">
        <div className={`detail-updated${saveStatus === 'error' ? ' is-error' : saveStatus === 'unsaved' ? ' is-unsaved' : ''}`}>
          {saveStatus === 'error' || saveStatus === 'unsaved' ? <AlertCircle size={13} /> : <Check size={13} />}
          {saveStatus === 'error' ? 'Ошибка сохранения' : saveStatus === 'unsaved' ? 'Есть несохранённые изменения' : saveStatus === 'saving' ? 'Сохранение…' : saveStatus === 'loading' ? 'Открытие рабочего пространства…' : 'Сохранено на устройстве'}
        </div>
        <button className="delete-node-button" onClick={handleDelete}><Trash2 size={14} /> Переместить в корзину</button>
      </div>
    </aside>
  )
}

function ConnectionGroup({ direction, connections, onSelectNode, onUpdateConnectionLabel, onDeleteConnection }: {
  direction: 'incoming' | 'outgoing'
  connections: RelatedConnection[]
  onSelectNode: (id: string | null) => void
  onUpdateConnectionLabel: (id: string, label: string) => void
  onDeleteConnection: (id: string) => void
}) {
  const label = direction === 'incoming' ? 'Входящие' : 'Исходящие'
  const emptyLabel = direction === 'incoming' ? 'входящих' : 'исходящих'
  const Icon = direction === 'incoming' ? ArrowDownRight : ArrowUpRight
  return (
    <div className={`connection-group connection-group--${direction}`}>
      <div className="connection-group__heading"><span><Icon size={12} /> {label}</span><span>{connections.length}</span></div>
      {connections.length > 0 ? (
        <div className="connected-list">
          {connections.map(({ edge, object }) => (
            <ConnectionRow
              key={edge.id}
              direction={direction}
              edge={edge}
              object={object}
              onSelectNode={onSelectNode}
              onUpdateLabel={onUpdateConnectionLabel}
              onDelete={onDeleteConnection}
            />
          ))}
        </div>
      ) : <p className="connection-direction-empty">Нет {emptyLabel} связей</p>}
    </div>
  )
}

function ConnectionRow({ direction, edge, object, onSelectNode, onUpdateLabel, onDelete }: {
  direction: 'incoming' | 'outgoing'
  edge: CanvasEdgeData
  object: CanvasNodeData
  onSelectNode: (id: string | null) => void
  onUpdateLabel: (id: string, label: string) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(edge.label)
  const editButtonRef = useRef<HTMLButtonElement>(null)
  const wasEditing = useRef(false)

  useEffect(() => { setDraft(edge.label) }, [edge.id, edge.label])
  useEffect(() => {
    if (wasEditing.current && !editing) editButtonRef.current?.focus()
    wasEditing.current = editing
  }, [editing])

  const cancelEdit = () => {
    setDraft(edge.label)
    setEditing(false)
  }

  const saveLabel = (event: FormEvent) => {
    event.preventDefault()
    const label = draft.trim()
    if (!label || label.length > 80) return
    onUpdateLabel(edge.id, label)
    setDraft(label)
    setEditing(false)
  }

  const connectionDirection = direction === 'incoming' ? 'входящую связь от объекта' : 'исходящую связь к объекту'
  const caption = getRelationCaption(edge)

  return (
    <div className="connection-row-item">
      <div className="connected-row-wrap">
        <button className="connected-row" aria-label={`Открыть ${connectionDirection} «${object.title}»; подпись: ${caption}`} onClick={() => onSelectNode(object.id)}>
          <span className={`recent-dot dot-${object.type}`} />
          <span className="connected-row__content"><span>{object.title}</span><small>{caption}</small></span><ChevronRight size={14} />
        </button>
        {!editing && <button ref={editButtonRef} className="connection-edit-button icon-button" aria-label={`Изменить подпись связи с объектом «${object.title}»`} title="Изменить подпись связи" onClick={() => setEditing(true)}><Pencil size={12} /></button>}
        {!editing && <button className="connection-remove-button icon-button" aria-label={`Удалить связь с объектом «${object.title}»`} title="Удалить связь" onClick={() => onDelete(edge.id)}><X size={12} /></button>}
      </div>
      {editing && (
        <form className="connection-label-editor" onSubmit={saveLabel}>
          <input
            aria-label={`Подпись связи с объектом «${object.title}»`}
            value={draft}
            maxLength={80}
            autoFocus
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                event.stopPropagation()
                cancelEdit()
              }
            }}
          />
          <button className="icon-button connection-label-save" type="submit" aria-label={`Сохранить подпись связи с объектом «${object.title}»`} title="Сохранить подпись" disabled={!draft.trim()}><Check size={12} /></button>
          <button className="icon-button connection-label-cancel" type="button" aria-label={`Отменить изменение подписи связи с объектом «${object.title}»`} title="Отменить" onClick={cancelEdit}><X size={12} /></button>
        </form>
      )}
    </div>
  )
}

function CustomPropertyEditor({ property, onUpdate, onRemove }: {
  property: CustomProperty
  onUpdate: (changes: Partial<Pick<CustomProperty, 'name' | 'value'>>) => void
  onRemove: () => void
}) {
  const [nameDraft, setNameDraft] = useState(property.name)
  useEffect(() => { setNameDraft(property.name) }, [property.id, property.name])

  return (
    <div className="custom-property-row">
      <div className="custom-property-row__header">
        <input
          aria-label={`Название свойства «${property.name}»`}
          maxLength={48}
          value={nameDraft}
          onChange={(event) => setNameDraft(event.target.value)}
          onBlur={() => {
            const name = nameDraft.trim().slice(0, 48)
            if (!name) setNameDraft(property.name)
            else if (name !== property.name) onUpdate({ name })
          }}
        />
        <button className="icon-button" aria-label={`Удалить свойство «${property.name}»`} onClick={onRemove}><X size={12} /></button>
      </div>
      <textarea
        aria-label={`Значение свойства «${property.name}»`}
        rows={2}
        maxLength={1200}
        value={property.value}
        onChange={(event) => onUpdate({ value: event.target.value })}
      />
    </div>
  )
}

function KindGlyph({ kind }: { kind: NodeKind }) {
  const glyph: Record<NodeKind, string> = {
    idea: '✳', concept: '⌘', knowledge: '◈', project: '◇', task: '✓',
    note: '≡', resource: '↗', question: '?', hypothesis: '∴', decision: '◆',
  }
  return <span aria-hidden="true">{glyph[kind]}</span>
}
