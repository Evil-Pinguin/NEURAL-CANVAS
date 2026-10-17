import { useMemo, useState, type ReactNode } from 'react'
import { ArrowRight, Check, CheckCircle2, Clock3, FolderKanban, Lightbulb, MoreHorizontal, Network, Plus, RotateCcw, Sparkles, Star, StickyNote, Trash2 } from 'lucide-react'
import type { CanvasNodeData, NodeKind, Workspace, WorkspaceFilters, WorkspaceView } from '../domain/model'
import { getNodeContent, knowledgeNodeTypes, kindLabels, priorityLabels, statusLabels } from '../domain/model'
import { formatRussianCount, formatRussianDate } from '../utils/locale'
import { useWorkspaceStore } from '../store/workspace-store'
import { matchesNode } from '../utils/search'
import KnowledgeBase from './KnowledgeBase'
import DeveloperWorkspace from './DeveloperWorkspace'
import NotesEditor from './NotesEditor'
import GraphIntelligence from './GraphIntelligence'

type WorkspaceViewsProps = {
  view: Exclude<WorkspaceView, 'canvas'>
  workspace: Workspace
  query: string
  filters: WorkspaceFilters
  onCreate: (kind: NodeKind) => void
  onOpenNode: (id: string) => void
  onFocusGraphSelection?: (nodeIds: string[], edgeIds: string[]) => void
  onQueryChange?: (query: string) => void
  selectedNodeId?: string | null
  architectureNoteToOpen?: string | null
  onArchitectureNoteOpenHandled?: () => void
}
type WorkspaceViewContentProps = Omit<WorkspaceViewsProps, 'view'>

const columns = [
  { status: 'planned' as const, label: 'Скоро', icon: Clock3 },
  { status: 'in-progress' as const, label: 'В работе', icon: Sparkles },
  { status: 'done' as const, label: 'Завершено', icon: CheckCircle2 },
]

export default function WorkspaceViews({ view, selectedNodeId, architectureNoteToOpen, onArchitectureNoteOpenHandled, ...props }: WorkspaceViewsProps) {
  if (view === 'overview') return <OverviewView {...props} />
  if (view === 'graph-intelligence') return <GraphIntelligence {...props} />
  if (view === 'developer') return <DeveloperWorkspace {...props} selectedNodeId={selectedNodeId} architectureNoteToOpen={architectureNoteToOpen} onArchitectureNoteOpenHandled={onArchitectureNoteOpenHandled} />
  if (view === 'tasks') return <TasksView {...props} />
  if (view === 'projects') return <ProjectsView {...props} />
  if (view === 'notes') return <NotesView {...props} />
  if (view === 'recent') return <RecentView {...props} />
  if (view === 'favorites') return <FavoritesView {...props} />
  if (view === 'trash') return <TrashView {...props} />
  return <KnowledgeBase {...props} />
}

function OverviewView({ workspace, query, filters, onCreate, onOpenNode }: WorkspaceViewContentProps) {
  const liveNodes = workspace.nodes.filter((node) => !node.deletedAt)
  const visibleRecent = liveNodes.filter((node) => matchesNode(node, query, filters))
    .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt))
    .slice(0, 5)
  const favorites = liveNodes.filter((node) => node.favorite && matchesNode(node, query, filters)).slice(0, 4)
  const openTasks = liveNodes.filter((node) => node.type === 'task' && node.status !== 'done' && node.status !== 'archived').length
  const projectCount = liveNodes.filter((node) => node.type === 'project').length
  const knowledgeCount = liveNodes.filter((node) => knowledgeNodeTypes.includes(node.type)).length

  return (
    <div className="content-page overview-page">
      <PageHeader eyebrow="ВАШЕ ПРОСТРАНСТВО" title="Обзор" description="Посмотрите, какие идеи, знания и задачи сейчас в работе." count={formatRussianCount(liveNodes.length, { one: 'объект', few: 'объекта', many: 'объектов' })} actionLabel="Записать мысль" onAction={() => onCreate('idea')} />
      <div className="overview-stat-grid">
        <OverviewStat icon={<Network size={16} />} label="Материалы базы знаний" value={knowledgeCount} tone="violet" />
        <OverviewStat icon={<FolderKanban size={16} />} label="Проекты" value={projectCount} tone="rose" />
        <OverviewStat icon={<Check size={16} />} label="Открытые задачи" value={openTasks} tone="cyan" />
        <OverviewStat icon={<Star size={16} />} label="Избранное" value={liveNodes.filter((node) => node.favorite).length} tone="amber" />
      </div>
      <div className="overview-columns">
        <section className="overview-section">
          <div className="collection-section-heading"><div><Clock3 size={15} /><h2>Недавно изменённые</h2></div><span>{visibleRecent.length}</span></div>
          <WorkspaceNodeList nodes={visibleRecent} onOpenNode={onOpenNode} />
          {visibleRecent.length === 0 && <EmptyState icon={<Clock3 size={19} />} title="Недавних объектов нет" text="Здесь появятся объекты, соответствующие поиску." />}
        </section>
        <section className="overview-section overview-section--favorites">
          <div className="collection-section-heading"><div><Star size={15} /><h2>Избранное</h2></div><span>{favorites.length}</span></div>
          {favorites.length > 0 ? <WorkspaceNodeList nodes={favorites} onOpenNode={onOpenNode} /> : <EmptyState icon={<Star size={19} />} title="Избранное пока пусто" text="Добавьте мысль в избранное, чтобы держать её под рукой." />}
        </section>
      </div>
    </div>
  )
}

function OverviewStat({ icon, label, value, tone }: { icon: ReactNode; label: string; value: number; tone: string }) {
  return <div className={`overview-stat overview-stat--${tone}`}><span className="overview-stat__icon">{icon}</span><span className="overview-stat__label">{label}</span><strong>{value.toString().padStart(2, '0')}</strong></div>
}

function TasksView({ workspace, query, filters, onCreate, onOpenNode }: WorkspaceViewContentProps) {
  const updateNode = useWorkspaceStore((state) => state.updateNode)
  const tasks = useMemo(() => workspace.nodes.filter((node) => !node.deletedAt && node.type === 'task' && node.status !== 'archived' && matchesNode(node, query, filters)), [workspace.nodes, query, filters])

  const moveTask = (node: CanvasNodeData) => {
    const nextStatus = node.status === 'planned' || node.status === 'active'
      ? 'in-progress'
      : node.status === 'in-progress' ? 'done' : 'planned'
    updateNode(node.id, { status: nextStatus })
  }

  return (
    <div className="content-page tasks-page">
      <PageHeader eyebrow="ПЛАНИРОВАНИЕ РАБОТЫ" title="Задачи" description="Превращайте связанные идеи в последовательные шаги." count={formatRussianCount(tasks.length, { one: 'задача', few: 'задачи', many: 'задач' })} actionLabel="Новая задача" onAction={() => onCreate('task')} />
      <div className="board-toolbar">
        <div className="board-view-label"><span className="view-icon view-icon--task"><Check size={14} /></span><strong>Доска задач</strong></div>
        <span className="board-toolbar__hint"><span className="green-pulse" /> {formatRussianCount(tasks.filter((task) => task.status === 'in-progress').length, { one: 'задача в работе', few: 'задачи в работе', many: 'задач в работе' })}</span>
        <span className="board-more-icon" aria-hidden="true"><MoreHorizontal size={17} /></span>
      </div>
      <div className="task-board">
        {columns.map(({ status, label, icon: Icon }) => {
          const items = tasks.filter((node) => status === 'planned'
            ? node.status === 'planned' || node.status === 'active'
            : node.status === status)
          return (
            <section className={`task-column task-column--${status}`} key={status}>
              <div className="task-column__header"><div><Icon size={15} /><h2>{label}</h2><span className="column-count">{items.length}</span></div><button className="icon-button small-icon-button" aria-label={`Добавить задачу в раздел «${label}»`} onClick={() => onCreate('task')}><Plus size={15} /></button></div>
              <div className="task-column__cards">
                {items.map((task) => (
                  <article
                    className="task-card"
                    key={task.id}
                    tabIndex={0}
                    onClick={() => onOpenNode(task.id)}
                    onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onOpenNode(task.id) }}
                  >
                    <div className="task-card__top"><span className={`task-priority priority-${task.priority}`} title={`Приоритет: ${priorityLabels[task.priority]}`}><i />{priorityLabels[task.priority]}</span><button className="icon-button task-card__more" aria-label={`Открыть задачу «${task.title}»`} onClick={(event) => { event.stopPropagation(); onOpenNode(task.id) }}><ArrowRight size={14} /></button></div>
                    <h3>{task.title}</h3>
                    {task.description && <p>{task.description}</p>}
                    <div className="task-card__bottom">
                      <div className="task-card__tags">{task.tags.slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}</div>
                      <button className={`task-move-button${task.status === 'done' ? ' is-done' : ''}`} onClick={(event) => { event.stopPropagation(); moveTask(task) }} title="Переместить задачу в следующий статус">
                        {task.status === 'done' ? <Check size={12} /> : <ArrowRight size={12} />}
                        {task.status === 'planned' || task.status === 'active' ? 'Начать' : task.status === 'in-progress' ? 'Завершить' : 'Вернуть в работу'}
                      </button>
                    </div>
                  </article>
                ))}
                {items.length === 0 && <div className="column-empty"><span>Задач пока нет</span><button onClick={() => onCreate('task')}><Plus size={13} /> Добавить задачу</button></div>}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function ProjectsView({ workspace, query, filters, onCreate, onOpenNode }: WorkspaceViewContentProps) {
  const projects = useMemo(() => workspace.nodes.filter((node) => !node.deletedAt && node.type === 'project' && matchesNode(node, query, filters)), [workspace.nodes, query, filters])
  const liveNodes = workspace.nodes.filter((node) => !node.deletedAt)
  const getRelatedCount = (id: string) => workspace.edges.filter((edge) => edge.sourceId === id || edge.targetId === id).length
  const getProjectProgress = (id: string) => {
    const linkedIds = workspace.edges.filter((edge) => edge.sourceId === id || edge.targetId === id).map((edge) => edge.sourceId === id ? edge.targetId : edge.sourceId)
    const relatedTasks = liveNodes.filter((node) => node.type === 'task' && node.status !== 'archived' && linkedIds.includes(node.id))
    if (relatedTasks.length === 0) return null
    return Math.round((relatedTasks.filter((task) => task.status === 'done').length / relatedTasks.length) * 100)
  }

  return (
    <div className="content-page projects-page">
      <PageHeader eyebrow="СИСТЕМНОЕ ПЛАНИРОВАНИЕ" title="Проекты" description="Соберите цель, план и текущую работу в одном месте." count={formatRussianCount(projects.length, { one: 'проект', few: 'проекта', many: 'проектов' })} actionLabel="Новый проект" onAction={() => onCreate('project')} />
      <div className="project-summary"><div className="summary-glyph"><FolderKanban size={17} /></div><span>{formatRussianCount(projects.filter((project) => project.status === 'in-progress').length, { one: 'проект в работе', few: 'проекта в работе', many: 'проектов в работе' })}</span><span className="summary-separator" /><span>{formatRussianCount(liveNodes.filter((node) => node.type === 'task' && node.status !== 'done' && node.status !== 'archived').length, { one: 'открытая задача в ваших проектах', few: 'открытые задачи в ваших проектах', many: 'открытых задач в ваших проектах' })}</span></div>
      <div className="project-grid">
        {projects.map((project, index) => {
          const progress = getProjectProgress(project.id)
          return (
            <article className={`project-card project-card--${index % 3}`} key={project.id} onClick={() => onOpenNode(project.id)} tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') onOpenNode(project.id) }}>
              <div className="project-card__top"><div className="project-glyph"><FolderKanban size={17} /></div><button className="icon-button" aria-label={`Открыть проект «${project.title}»`} onClick={(event) => { event.stopPropagation(); onOpenNode(project.id) }}><ArrowRight size={15} /></button></div>
              <span className={`status-label status-${project.status}`}><i />{statusLabels[project.status]}</span>
              <h2>{project.title}</h2>
              <p>{project.description || 'Добавьте описание, чтобы сохранить контекст проекта.'}</p>
              {progress !== null && <div className="project-progress"><div className="project-progress__copy"><span>Связанные задачи</span><strong>{progress}%</strong></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div></div>}
              <div className="project-card__footer"><span><Network size={13} /> {formatRussianCount(getRelatedCount(project.id), { one: 'связь', few: 'связи', many: 'связей' })}</span><div>{project.tags.slice(0, 2).map((tag) => <i key={tag}>{tag}</i>)}</div></div>
            </article>
          )
        })}
        <button className="project-add-card" onClick={() => onCreate('project')}><span><Plus size={18} /></span><strong>Создать проект</strong><small>Дайте идее место для развития</small></button>
      </div>
      {projects.length === 0 && <EmptyState icon={<FolderKanban size={20} />} title="Проекты не найдены" text="Создайте проект, чтобы связать задачи и идеи." onCreate={() => onCreate('project')} />}
    </div>
  )
}

function NotesView({ workspace, query, filters, onCreate, onOpenNode, onQueryChange }: WorkspaceViewContentProps) {
  return <NotesEditor workspace={workspace} query={query} filters={filters} onQueryChange={onQueryChange} onCreate={onCreate} onOpenNode={onOpenNode} />
}

function RecentView({ workspace, query, filters, onCreate, onOpenNode }: WorkspaceViewContentProps) {
  const recent = workspace.nodes.filter((node) => !node.deletedAt && matchesNode(node, query, filters))
    .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt))
  return (
    <CollectionPage
      eyebrow="ПОСЛЕДНИЕ ИЗМЕНЕНИЯ"
      title="Недавние"
      description="Продолжите с того места, где остановились: здесь собраны последние изменения."
      nodes={recent}
      onCreate={() => onCreate('idea')}
      actionLabel="Записать мысль"
      onOpenNode={onOpenNode}
      emptyTitle="Недавних объектов нет"
      emptyText="Здесь появятся новые и изменённые объекты."
      emptyIcon={<Clock3 size={20} />}
    />
  )
}

function FavoritesView({ workspace, query, filters, onOpenNode }: WorkspaceViewContentProps) {
  const favorites = workspace.nodes.filter((node) => !node.deletedAt && node.favorite && matchesNode(node, query, filters))
    .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt))
  return (
    <CollectionPage
      eyebrow="СОХРАНЕНО НА ПОТОМ"
      title="Избранное"
      description="Мысли и материалы, которые вы хотите держать под рукой."
      nodes={favorites}
      onCreate={() => undefined}
      actionLabel=""
      onOpenNode={onOpenNode}
      emptyTitle="Избранное пока пусто"
      emptyText="Нажмите на звёздочку в карточке объекта, чтобы добавить его сюда."
      emptyIcon={<Star size={20} />}
      emptyAction={false}
    />
  )
}

function CollectionPage({ eyebrow, title, description, nodes, onCreate, actionLabel, onOpenNode, emptyTitle, emptyText, emptyIcon, emptyAction = true }: {
  eyebrow: string
  title: string
  description: string
  nodes: CanvasNodeData[]
  onCreate: () => void
  actionLabel: string
  onOpenNode: (id: string) => void
  emptyTitle: string
  emptyText: string
  emptyIcon: ReactNode
  emptyAction?: boolean
}) {
  return (
    <div className="content-page collection-page">
      <PageHeader eyebrow={eyebrow} title={title} description={description} count={formatRussianCount(nodes.length, { one: 'объект', few: 'объекта', many: 'объектов' })} actionLabel={actionLabel} onAction={onCreate} />
      <WorkspaceNodeList nodes={nodes} onOpenNode={onOpenNode} />
      {nodes.length === 0 && <EmptyState icon={emptyIcon} title={emptyTitle} text={emptyText} onCreate={emptyAction ? onCreate : undefined} />}
    </div>
  )
}

function WorkspaceNodeList({ nodes, onOpenNode }: { nodes: CanvasNodeData[]; onOpenNode: (id: string) => void }) {
  const toggleFavorite = useWorkspaceStore((state) => state.toggleFavorite)
  return (
    <div className="workspace-node-list">
      {nodes.map((node) => (
        <article className="workspace-node-row" key={node.id}>
          <button className="workspace-node-row__open" onClick={() => onOpenNode(node.id)}>
            <span className={`workspace-node-row__icon workspace-node-row__icon--${node.type}`}>{node.type === 'idea' ? <Lightbulb size={15} /> : node.type === 'project' ? <FolderKanban size={15} /> : node.type === 'task' ? <Check size={15} /> : node.type === 'resource' ? <ArrowRight size={15} /> : node.type === 'note' ? <StickyNote size={15} /> : <Network size={15} />}</span>
            <span className="workspace-node-row__copy"><strong>{node.title}</strong><span>{getNodeContent(node) || 'Заметок пока нет.'}</span></span>
            <span className={`knowledge-kind knowledge-kind--${node.type}`}>{kindLabels[node.type]}</span>
            <span className="workspace-node-row__status">{statusLabels[node.status]}</span>
          </button>
          <button className={`workspace-node-row__favorite${node.favorite ? ' is-favorite' : ''}`} aria-label={node.favorite ? `Убрать «${node.title}» из избранного` : `Добавить «${node.title}» в избранное`} aria-pressed={Boolean(node.favorite)} onClick={() => toggleFavorite(node.id)}><Star size={14} fill={node.favorite ? 'currentColor' : 'none'} /></button>
        </article>
      ))}
    </div>
  )
}

function TrashView({ workspace, query, filters }: WorkspaceViewContentProps) {
  const restoreNode = useWorkspaceStore((state) => state.restoreNode)
  const deleteNode = useWorkspaceStore((state) => state.deleteNode)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const trashed = workspace.nodes.filter((node) => node.deletedAt && matchesNode(node, query, filters))
    .sort((first, second) => (second.deletedAt ?? '').localeCompare(first.deletedAt ?? ''))

  return (
    <div className="content-page collection-page trash-page">
      <PageHeader eyebrow="УДАЛЁННОЕ МОЖНО ВОССТАНОВИТЬ" title="Корзина" description="Удалённые объекты останутся здесь, пока вы не восстановите или не удалите их навсегда." count={formatRussianCount(trashed.length, { one: 'объект', few: 'объекта', many: 'объектов' })} actionLabel="" onAction={() => undefined} />
      {trashed.length > 0 && <div className="trash-note"><Trash2 size={14} /><span>Объекты из корзины скрыты с холста и из библиотек.</span></div>}
      <div className="workspace-node-list workspace-node-list--trash">
        {trashed.map((node) => (
          <article className="workspace-node-row" key={node.id}>
            <div className="workspace-node-row__open workspace-node-row__open--static">
              <span className={`workspace-node-row__icon workspace-node-row__icon--${node.type}`}><Trash2 size={15} /></span>
              <span className="workspace-node-row__copy"><strong>{node.title}</strong><span>{getNodeContent(node) || 'Заметок пока нет.'}</span></span>
              <span className={`knowledge-kind knowledge-kind--${node.type}`}>{kindLabels[node.type]}</span>
              <span className="workspace-node-row__status">{node.deletedAt ? `Удалено ${formatRussianDate(node.deletedAt)}` : ''}</span>
            </div>
            <div className="trash-row-actions">
              <button className="trash-restore-button" aria-label={`Восстановить «${node.title}»`} onClick={() => { restoreNode(node.id); setConfirmDeleteId(null) }}><RotateCcw size={13} /> Восстановить</button>
              {confirmDeleteId === node.id ? (
                <span className="trash-confirm-actions"><button onClick={() => { deleteNode(node.id); setConfirmDeleteId(null) }}>Удалить навсегда</button><button onClick={() => setConfirmDeleteId(null)}>Отмена</button></span>
              ) : <button className="trash-delete-button" aria-label={`Удалить «${node.title}» навсегда`} onClick={() => setConfirmDeleteId(node.id)} title="Удалить навсегда"><Trash2 size={13} /></button>}
            </div>
          </article>
        ))}
      </div>
      {trashed.length === 0 && <EmptyState icon={<Trash2 size={20} />} title="Корзина пуста" text="Здесь появятся удалённые объекты. Их можно будет восстановить." />}
    </div>
  )
}

function PageHeader({ eyebrow, title, description, count, actionLabel, onAction }: { eyebrow: string; title: string; description: string; count: string; actionLabel: string; onAction: () => void }) {
  return (
    <div className="page-header">
      <div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
      <div className="page-header__actions"><span className="page-count">{count}</span>{actionLabel && <button className="button-primary" onClick={onAction}><Plus size={15} />{actionLabel}</button>}</div>
    </div>
  )
}

function EmptyState({ icon, title, text, onCreate }: { icon: ReactNode; title: string; text: string; onCreate?: () => void }) {
  return <div className="empty-state" role="status"><span aria-hidden="true">{icon}</span><h2>{title}</h2><p>{text}</p>{onCreate && <button className="button-secondary" onClick={onCreate}><Plus size={14} aria-hidden="true" /> Создать</button>}</div>
}
