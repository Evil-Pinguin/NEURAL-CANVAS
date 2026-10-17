import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from 'react'
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  FlaskConical,
  Grid2X2,
  Lightbulb,
  List,
  Network,
  Plus,
  Search,
  Sparkles,
  Star,
  StickyNote,
  X,
} from 'lucide-react'
import type { CanvasEdgeData, CanvasNodeData, NodeColor, NodeKind, NodeType, Workspace, WorkspaceFilters } from '../domain/model'
import { getNodeContent, getRelationCaption, knowledgeNodeTypes, kindLabels, newNodeTitleLabels, nodeColorHex, nodeColorLabels, nodeColors } from '../domain/model'
import { useWorkspaceStore } from '../store/workspace-store'
import { matchesNode } from '../utils/search'
import { formatRussianCount, formatRussianDate } from '../utils/locale'
import KnowledgeGraphView from './KnowledgeGraphView'

type KnowledgeBaseProps = {
  workspace: Workspace
  query: string
  filters: WorkspaceFilters
  onQueryChange?: (query: string) => void
  onCreate: (type: NodeKind) => void
  onOpenNode: (id: string) => void
}

type DisplayMode = 'grid' | 'list' | 'graph'
type SortMode = 'updated-desc' | 'updated-asc' | 'title-asc' | 'connections-desc'
type RelatedItem = { edge: CanvasEdgeData; node: CanvasNodeData; direction: 'incoming' | 'outgoing' }

const knowledgeTypeOptions = knowledgeNodeTypes as readonly NodeType[]
const sortOptions: { value: SortMode; label: string }[] = [
  { value: 'updated-desc', label: 'Недавно изменённые' },
  { value: 'updated-asc', label: 'Давно не изменялись' },
  { value: 'title-asc', label: 'Название: А–Я' },
  { value: 'connections-desc', label: 'Больше всего связей' },
]

export default function KnowledgeBase({ workspace, query, filters, onQueryChange, onCreate, onOpenNode }: KnowledgeBaseProps) {
  const [displayMode, setDisplayMode] = useState<DisplayMode>('grid')
  const [sortMode, setSortMode] = useState<SortMode>('updated-desc')
  const [typeFilter, setTypeFilter] = useState<NodeType | 'all'>('all')
  const [updatedAfter, setUpdatedAfter] = useState('')
  const [updatedBefore, setUpdatedBefore] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [createType, setCreateType] = useState<NodeType>('note')
  const [previewId, setPreviewId] = useState<string | null>(null)

  const liveNodeIds = useMemo(() => new Set(workspace.nodes.filter((node) => !node.deletedAt).map((node) => node.id)), [workspace.nodes])
  const connectionCounts = useMemo(() => {
    const counts = new Map<string, number>()
    workspace.edges.forEach((edge) => {
      if (!liveNodeIds.has(edge.sourceId) || !liveNodeIds.has(edge.targetId)) return
      counts.set(edge.sourceId, (counts.get(edge.sourceId) ?? 0) + 1)
      counts.set(edge.targetId, (counts.get(edge.targetId) ?? 0) + 1)
    })
    return counts
  }, [workspace.edges, liveNodeIds])

  const entries = useMemo(() => {
    const afterTime = updatedAfter ? new Date(`${updatedAfter}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY
    const beforeTime = updatedBefore ? new Date(`${updatedBefore}T23:59:59.999`).getTime() : Number.POSITIVE_INFINITY
    const visible = workspace.nodes.filter((node) => {
      if (node.deletedAt || !knowledgeTypeOptions.includes(node.type)) return false
      if (!matchesNode(node, query, filters)) return false
      if (typeFilter !== 'all' && node.type !== typeFilter) return false
      if (favoritesOnly && !node.favorite) return false
      const updatedTime = new Date(node.updatedAt).getTime()
      return updatedTime >= afterTime && updatedTime <= beforeTime
    })

    return visible.sort((first, second) => {
      if (sortMode === 'updated-asc') return first.updatedAt.localeCompare(second.updatedAt)
      if (sortMode === 'title-asc') return first.title.localeCompare(second.title, undefined, { sensitivity: 'base' })
      if (sortMode === 'connections-desc') {
        const difference = (connectionCounts.get(second.id) ?? 0) - (connectionCounts.get(first.id) ?? 0)
        return difference || second.updatedAt.localeCompare(first.updatedAt)
      }
      return second.updatedAt.localeCompare(first.updatedAt)
    })
  }, [workspace.nodes, query, filters, typeFilter, updatedAfter, updatedBefore, favoritesOnly, sortMode, connectionCounts])

  const previewNode = previewId ? workspace.nodes.find((node) => node.id === previewId && !node.deletedAt) ?? null : null
  const clearLocalFilters = () => {
    setTypeFilter('all')
    setUpdatedAfter('')
    setUpdatedBefore('')
    setFavoritesOnly(false)
  }

  const createObject = () => {
    clearLocalFilters()
    onCreate(createType)
    const selectedId = useWorkspaceStore.getState().selectedNodeId
    setPreviewId(selectedId)
  }

  const modeButtons: { mode: DisplayMode; label: string; icon: typeof Grid2X2 }[] = [
    { mode: 'grid', label: 'Плитки', icon: Grid2X2 },
    { mode: 'list', label: 'Список', icon: List },
    { mode: 'graph', label: 'Граф', icon: Network },
  ]

  return (
    <div className="content-page knowledge-page">
      <header className="knowledge-page-header">
        <div>
          <span className="eyebrow">ВАША БАЗА ЗНАНИЙ</span>
          <h1>База знаний</h1>
          <p>Ищите идеи, заметки и полезные концепции, изучайте связи между ними.</p>
        </div>
        <div className="knowledge-page-header__actions">
          <span className="page-count">{formatRussianCount(entries.length, { one: 'объект', few: 'объекта', many: 'объектов' })}</span>
          <label className="knowledge-create-type">
            <span className="visually-hidden">Тип нового объекта</span>
            <select aria-label="Тип нового объекта" value={createType} onChange={(event) => setCreateType(event.target.value as NodeType)}>
              {knowledgeTypeOptions.map((type) => <option key={type} value={type}>{kindLabels[type]}</option>)}
            </select>
          </label>
          <button className="button-primary" onClick={createObject}><Plus size={15} /> Новый объект</button>
        </div>
      </header>

      <div className="knowledge-controls" aria-label="Управление базой знаний">
        <label className="knowledge-search">
          <Search size={14} />
          <input
            type="search"
            aria-label="Поиск по базе знаний"
            placeholder="Поиск по названию, описанию или тегам"
            value={query}
            onChange={(event) => onQueryChange?.(event.target.value)}
          />
          {query && <button type="button" aria-label="Очистить поиск по базе знаний" onClick={() => onQueryChange?.('')}><X size={12} /></button>}
        </label>
        <div className="knowledge-filters">
          <label>
            <span className="visually-hidden">Фильтр базы знаний по типу</span>
            <select aria-label="Фильтр базы знаний по типу" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as NodeType | 'all')}>
              <option value="all">Все типы</option>
              {knowledgeTypeOptions.map((type) => <option key={type} value={type}>{kindLabels[type]}</option>)}
            </select>
          </label>
          <label className="knowledge-date-filter">
            <CalendarDays size={12} />
            <span>После</span>
            <input aria-label="Изменено после" type="date" value={updatedAfter} max={updatedBefore || undefined} onChange={(event) => setUpdatedAfter(event.target.value)} />
          </label>
          <label className="knowledge-date-filter">
            <span>До</span>
            <input aria-label="Изменено до" type="date" value={updatedBefore} min={updatedAfter || undefined} onChange={(event) => setUpdatedBefore(event.target.value)} />
          </label>
          <label>
            <span className="visually-hidden">Сортировка базы знаний</span>
            <select aria-label="Сортировка базы знаний" value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
              {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <button className={`knowledge-favorites-toggle${favoritesOnly ? ' is-active' : ''}`} aria-label="Показывать только избранное" aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly((value) => !value)}>
            <Star size={13} fill={favoritesOnly ? 'currentColor' : 'none'} /><span>Избранное</span>
          </button>
          <div className="knowledge-mode-toggle" role="group" aria-label="Режим отображения базы знаний">
            {modeButtons.map(({ mode, label, icon: Icon }) => (
              <button key={mode} aria-label={label} aria-pressed={displayMode === mode} title={label} onClick={() => setDisplayMode(mode)}>
                <Icon size={14} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {(typeFilter !== 'all' || updatedAfter || updatedBefore || favoritesOnly) && (
        <div className="knowledge-active-filters">
          <span>{formatRussianCount(entries.length, { one: 'подходящий объект', few: 'подходящих объекта', many: 'подходящих объектов' })}</span>
          <button onClick={clearLocalFilters}>Сбросить фильтры базы знаний</button>
        </div>
      )}

      <div className={`knowledge-browser knowledge-browser--${displayMode}${previewNode ? ' has-preview' : ''}`}>
        <section className="knowledge-results" aria-label="Объекты базы знаний">
          {displayMode === 'grid' && (
            <div className="knowledge-card-grid">
              {entries.map((node) => (
                <KnowledgeCard
                  key={node.id}
                  node={node}
                  connectionCount={connectionCounts.get(node.id) ?? 0}
                  selected={previewId === node.id}
                  onPreview={() => setPreviewId(node.id)}
                  onOpen={() => onOpenNode(node.id)}
                />
              ))}
            </div>
          )}
          {displayMode === 'list' && (
            <div className="knowledge-table" role="list" aria-label="Список базы знаний">
              {entries.map((node) => (
                <KnowledgeListRow
                  key={node.id}
                  node={node}
                  connectionCount={connectionCounts.get(node.id) ?? 0}
                  selected={previewId === node.id}
                  onPreview={() => setPreviewId(node.id)}
                  onOpen={() => onOpenNode(node.id)}
                />
              ))}
            </div>
          )}
          {displayMode === 'graph' && (
            <KnowledgeGraphView
              workspace={workspace}
              nodeIds={entries.map((node) => node.id)}
              selectedNodeId={previewId}
              onSelectNode={setPreviewId}
              onOpenNode={onOpenNode}
            />
          )}
          {entries.length === 0 && displayMode !== 'graph' && (
            <div className="knowledge-empty-results">
              <BookOpen size={20} />
              <h2>Ничего не найдено</h2>
              <p>Сбросьте фильтры или создайте новый объект.</p>
              <button className="button-secondary" onClick={clearLocalFilters}><X size={13} /> Сбросить фильтры</button>
            </div>
          )}
        </section>
        {previewNode && (
          <KnowledgePreview
            key={previewNode.id}
            node={previewNode}
            workspace={workspace}
            connectionCount={connectionCounts.get(previewNode.id) ?? 0}
            onClose={() => setPreviewId(null)}
            onSelectRelated={setPreviewId}
            onOpenNode={onOpenNode}
          />
        )}
      </div>
    </div>
  )
}

function KnowledgeCard({ node, connectionCount, selected, onPreview, onOpen }: {
  node: CanvasNodeData
  connectionCount: number
  selected: boolean
  onPreview: () => void
  onOpen: () => void
}) {
  const toggleFavorite = useWorkspaceStore((state) => state.toggleFavorite)
  return (
    <article className={`knowledge-card${selected ? ' is-selected' : ''}`}>
      <div className="knowledge-card__topline">
        <span className={`knowledge-kind knowledge-kind--${node.type}`}>{kindLabels[node.type]}</span>
        <button className={`knowledge-favorite-button${node.favorite ? ' is-favorite' : ''}`} aria-label={node.favorite ? `Убрать «${node.title}» из избранного` : `Добавить «${node.title}» в избранное`} aria-pressed={node.favorite} onClick={() => toggleFavorite(node.id)} title={node.favorite ? 'Убрать из избранного' : 'Добавить в избранное'}>
          <Star size={14} fill={node.favorite ? 'currentColor' : 'none'} />
        </button>
      </div>
      <button className="knowledge-card__main" onClick={onPreview} aria-label={`Предпросмотр «${node.title}»`}>
        <span className={`knowledge-row__icon knowledge-row__icon--${node.type}`}><KnowledgeIcon type={node.type} /></span>
        <strong>{node.title}</strong>
        <span className="knowledge-card__description">{getNodeContent(node) || 'Описания и заметки пока нет.'}</span>
      </button>
      <div className="knowledge-card__tags">{node.tags.slice(0, 3).map((tag) => <span key={tag}>#{tag}</span>)}</div>
      <div className="knowledge-card__footer">
        <span title="Связи"><Network size={12} /> {connectionCount}</span>
        <time dateTime={node.updatedAt} title={`Изменено ${formatDate(node.updatedAt)}`}><Clock3 size={12} /> {formatShortDate(node.updatedAt)}</time>
        <button aria-label={`Открыть «${node.title}» на холсте`} onClick={onOpen}><ArrowRight size={13} /></button>
      </div>
    </article>
  )
}

function KnowledgeListRow({ node, connectionCount, selected, onPreview, onOpen }: {
  node: CanvasNodeData
  connectionCount: number
  selected: boolean
  onPreview: () => void
  onOpen: () => void
}) {
  const toggleFavorite = useWorkspaceStore((state) => state.toggleFavorite)
  return (
    <article className={`knowledge-list-row${selected ? ' is-selected' : ''}`} role="listitem">
      <button className="knowledge-list-row__preview" onClick={onPreview} aria-label={`Предпросмотр «${node.title}»`}>
        <span className={`knowledge-row__icon knowledge-row__icon--${node.type}`}><KnowledgeIcon type={node.type} /></span>
        <span className="knowledge-list-row__copy"><strong>{node.title}</strong><span>{getNodeContent(node) || 'Описания и заметки пока нет.'}</span></span>
        <span className={`knowledge-kind knowledge-kind--${node.type}`}>{kindLabels[node.type]}</span>
        <span className="knowledge-list-row__tags">{node.tags.slice(0, 2).map((tag) => `#${tag}`).join(' · ')}</span>
      </button>
      <span className="knowledge-list-row__connections" title={formatRussianCount(connectionCount, { one: 'связь', few: 'связи', many: 'связей' })}><Network size={12} /> {connectionCount}</span>
      <time className="knowledge-list-row__date" dateTime={node.updatedAt}>{formatShortDate(node.updatedAt)}</time>
      <button className={`knowledge-favorite-button${node.favorite ? ' is-favorite' : ''}`} aria-label={node.favorite ? `Убрать «${node.title}» из избранного` : `Добавить «${node.title}» в избранное`} aria-pressed={node.favorite} onClick={() => toggleFavorite(node.id)}><Star size={14} fill={node.favorite ? 'currentColor' : 'none'} /></button>
      <button className="knowledge-list-row__open" aria-label={`Открыть «${node.title}» на холсте`} onClick={onOpen}><ArrowRight size={14} /></button>
    </article>
  )
}

function KnowledgePreview({ node, workspace, connectionCount, onClose, onSelectRelated, onOpenNode }: {
  node: CanvasNodeData
  workspace: Workspace
  connectionCount: number
  onClose: () => void
  onSelectRelated: (id: string) => void
  onOpenNode: (id: string) => void
}) {
  const updateNode = useWorkspaceStore((state) => state.updateNode)
  const toggleFavorite = useWorkspaceStore((state) => state.toggleFavorite)
  const [editing, setEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState(node.title)
  const [descriptionDraft, setDescriptionDraft] = useState(getNodeContent(node))
  const [tagDraft, setTagDraft] = useState('')
  const noteRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setEditing(false)
    setTitleDraft(node.title)
    setDescriptionDraft(getNodeContent(node))
    setTagDraft('')
  }, [node.id])

  const related = useMemo<RelatedItem[]>(() => workspace.edges.flatMap((edge) => {
    const direction: RelatedItem['direction'] | null = edge.sourceId === node.id ? 'outgoing' : edge.targetId === node.id ? 'incoming' : null
    if (!direction) return []
    const relatedId = direction === 'outgoing' ? edge.targetId : edge.sourceId
    const object = workspace.nodes.find((item) => item.id === relatedId && !item.deletedAt)
    return object ? [{ edge, node: object, direction }] : []
  }).sort((first, second) => first.node.title.localeCompare(second.node.title)), [workspace.edges, workspace.nodes, node.id])

  const commitTitle = () => {
    const title = titleDraft.trim() || newNodeTitleLabels[node.type]
    setTitleDraft(title)
    if (title !== node.title) updateNode(node.id, { title })
  }

  const addTag = (event?: FormEvent | KeyboardEvent) => {
    event?.preventDefault()
    const tag = tagDraft.trim().replace(/^#/, '').slice(0, 48)
    if (!tag) return
    const currentTags = useWorkspaceStore.getState().workspace.nodes.find((item) => item.id === node.id)?.tags ?? node.tags
    if (currentTags.length < 20 && !currentTags.some((item) => item.toLocaleLowerCase() === tag.toLocaleLowerCase())) {
      updateNode(node.id, { tags: [...currentTags, tag] })
    }
    setTagDraft('')
  }

  const handleAddNote = () => {
    setEditing(true)
    window.setTimeout(() => noteRef.current?.focus(), 0)
  }

  return (
    <aside className="knowledge-preview" aria-label={`Быстрый просмотр: ${node.title}`}>
      <div className="knowledge-preview__header">
        <div><span className="eyebrow">БЫСТРЫЙ ПРОСМОТР</span><span className="knowledge-preview__count"><Network size={12} /> {formatRussianCount(connectionCount, { one: 'связь', few: 'связи', many: 'связей' })}</span></div>
        <button className="icon-button" aria-label="Закрыть предпросмотр базы знаний" onClick={onClose}><X size={15} /></button>
      </div>

      <div className="knowledge-preview__actions">
        <button className={`knowledge-favorite-button${node.favorite ? ' is-favorite' : ''}`} aria-label={node.favorite ? `Убрать «${node.title}» из избранного` : `Добавить «${node.title}» в избранное`} aria-pressed={node.favorite} onClick={() => toggleFavorite(node.id)}>
          <Star size={14} fill={node.favorite ? 'currentColor' : 'none'} />
        </button>
        <button className="button-secondary" onClick={() => setEditing((value) => !value)}>{editing ? <Check size={13} /> : <Sparkles size={13} />}{editing ? 'Завершить редактирование' : 'Изменить'}</button>
        <button className="button-primary" onClick={() => onOpenNode(node.id)}><ArrowRight size={13} /> Открыть на холсте</button>
      </div>

      <div className="knowledge-preview__body">
        <span className={`knowledge-kind knowledge-kind--${node.type}`}>{kindLabels[node.type]}</span>
        {editing ? (
          <label className="knowledge-preview__field">
            <span>НАЗВАНИЕ</span>
            <input
              aria-label="Название объекта базы знаний"
              maxLength={180}
              value={titleDraft}
              onChange={(event) => {
                setTitleDraft(event.target.value)
                if (event.target.value.trim()) updateNode(node.id, { title: event.target.value })
              }}
              onBlur={commitTitle}
            />
          </label>
        ) : <h2>{node.title}</h2>}

        {editing ? (
          <label className="knowledge-preview__field">
            <span>{node.type === 'note' ? 'СОДЕРЖИМОЕ ЗАМЕТКИ' : 'ОПИСАНИЕ / ЗАМЕТКА'}</span>
            <textarea
              ref={noteRef}
              aria-label={`Заметка для «${node.title}»`}
              rows={5}
              maxLength={node.type === 'note' ? 100000 : 5000}
              placeholder={node.type === 'note' ? 'Введите текст заметки в формате Markdown…' : 'Введите заметку или добавьте пояснение к этому объекту…'}
              value={descriptionDraft}
              onChange={(event) => {
                setDescriptionDraft(event.target.value)
                updateNode(node.id, node.type === 'note' ? { markdownContent: event.target.value } : { description: event.target.value })
              }}
            />
          </label>
        ) : (
          <div className="knowledge-preview__note">
            <p>{getNodeContent(node) || 'Заметок пока нет. Добавьте пояснение, вопрос или сведения об источнике.'}</p>
            <button className="knowledge-preview__note-action" onClick={handleAddNote}>{getNodeContent(node) ? 'Изменить заметку' : 'Добавить заметку'}</button>
          </div>
        )}

        {editing && (
          <div className="knowledge-preview__edit-section">
            <span className="knowledge-preview__section-label">ЦВЕТ</span>
            <div className="color-options" role="group" aria-label="Выбрать цвет объекта базы знаний">
              {nodeColors.map((color: NodeColor) => (
                <button
                  key={color}
                  className={`color-swatch${node.color === color ? ' is-selected' : ''}`}
                  style={{ '--swatch-color': nodeColorHex[color] } as CSSProperties}
                  aria-label={`Выбрать цвет: ${nodeColorLabels[color]}`}
                  aria-pressed={node.color === color}
                  onClick={() => updateNode(node.id, { color })}
                />
              ))}
            </div>
          </div>
        )}

        <div className="knowledge-preview__edit-section">
          <span className="knowledge-preview__section-label">ТЕГИ</span>
          <div className="knowledge-preview__tags">
            {node.tags.map((tag) => (
              <span className="editable-tag" key={tag}>
                #{tag}
                {editing && <button aria-label={`Удалить тег «${tag}»`} onClick={() => updateNode(node.id, { tags: node.tags.filter((item) => item !== tag) })}><X size={10} /></button>}
              </span>
            ))}
            {node.tags.length === 0 && <span className="knowledge-preview__muted">Тегов пока нет</span>}
          </div>
          {editing && (
            <form className="knowledge-preview__tag-form" onSubmit={(event) => addTag(event)}>
              <input
                aria-label="Добавить тег базы знаний"
                placeholder="Введите тег и нажмите Enter"
                maxLength={48}
                value={tagDraft}
                onChange={(event) => setTagDraft(event.target.value)}
                onBlur={() => { if (tagDraft.trim()) addTag() }}
                onKeyDown={(event) => { if (event.key === 'Enter') addTag(event) }}
                disabled={node.tags.length >= 20}
              />
              <button className="icon-button" aria-label="Добавить тег" disabled={!tagDraft.trim() || node.tags.length >= 20}><Plus size={13} /></button>
            </form>
          )}
        </div>

        <div className="knowledge-preview__meta">
          <span><Clock3 size={12} /> Изменено: {formatDate(node.updatedAt)}</span>
          <span><Network size={12} /> {formatRussianCount(connectionCount, { one: 'связь', few: 'связи', many: 'связей' })}</span>
        </div>

        <section className="knowledge-preview__related" aria-label="Связанные объекты">
          <div className="knowledge-preview__related-heading"><h3>Связанные объекты</h3><span>{related.length}</span></div>
          {related.length > 0 ? related.map(({ edge, node: relatedNode, direction }) => (
            <div className="knowledge-related-row" key={edge.id}>
              <button className="knowledge-related-row__open" onClick={() => onSelectRelated(relatedNode.id)} aria-label={`Предпросмотр связанного объекта «${relatedNode.title}»; подпись связи: ${getRelationCaption(edge)}`}>
                <span className={`knowledge-row__icon knowledge-row__icon--${relatedNode.type}`}><KnowledgeIcon type={relatedNode.type} /></span>
                <span><strong>{relatedNode.title}</strong><small>{direction === 'outgoing' ? 'Исходящая' : 'Входящая'} · {getRelationCaption(edge)}</small></span>
                <ChevronRight size={13} />
              </button>
              <button className="knowledge-related-row__canvas" aria-label={`Открыть «${relatedNode.title}» на холсте`} onClick={() => onOpenNode(relatedNode.id)} title="Открыть на холсте"><ArrowRight size={12} /></button>
            </div>
          )) : <p className="knowledge-preview__muted">Явных связей пока нет. Связанные объекты появятся здесь, когда вы их соедините.</p>}
        </section>
      </div>
    </aside>
  )
}

function KnowledgeIcon({ type }: { type: NodeType }) {
  if (type === 'idea') return <Lightbulb size={16} />
  if (type === 'concept') return <Network size={16} />
  if (type === 'question') return <CircleHelp size={16} />
  if (type === 'hypothesis') return <FlaskConical size={16} />
  if (type === 'decision') return <Check size={16} />
  if (type === 'note') return <StickyNote size={16} />
  if (type === 'knowledge') return <BookOpen size={16} />
  return <BookOpen size={16} />
}

function formatShortDate(value: string) {
  return formatRussianDate(value, { month: 'short', day: 'numeric' })
}

function formatDate(value: string) {
  return formatRussianDate(value, { dateStyle: 'medium', timeStyle: 'short' })
}
