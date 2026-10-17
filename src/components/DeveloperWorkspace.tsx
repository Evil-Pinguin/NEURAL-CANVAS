import { useEffect, useMemo, useState, type DragEvent, type FormEvent, type KeyboardEvent } from 'react'
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  Code2,
  Copy,
  ExternalLink,
  FileCode2,
  FileText,
  FolderKanban,
  GitBranch,
  Link2,
  List,
  Network,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
  Columns3,
} from 'lucide-react'
import {
  architectureNoteTypeLabels,
  architectureNoteTypes,
  developerTaskStatusLabels,
  developerTaskStatuses,
  getProjectStatus,
  getRelationCaption,
  getTaskStatus,
  kindLabels,
  nodePriorities,
  priorityLabels,
  projectStatusLabels,
  projectStatuses,
  toNodeStatus,
  type ArchitectureNote,
  type ArchitectureNoteType,
  type CanvasNodeData,
  type DeveloperTaskStatus,
  type NodePriority,
  type ProjectStatus,
  type Workspace,
  type WorkspaceFilters,
} from '../domain/model'
import { useWorkspaceStore } from '../store/workspace-store'
import { matchesNode } from '../utils/search'
import { formatRussianCount, formatRussianDate } from '../utils/locale'

type DeveloperWorkspaceProps = {
  workspace: Workspace
  query: string
  filters: WorkspaceFilters
  onQueryChange?: (query: string) => void
  onCreate: (type: CanvasNodeData['type']) => void
  onOpenNode: (id: string) => void
  selectedNodeId?: string | null
  architectureNoteToOpen?: string | null
  onArchitectureNoteOpenHandled?: () => void
}

type DeveloperTab = 'projects' | 'tasks' | 'architecture'
type TaskLayout = 'list' | 'kanban'

const tabs: { id: DeveloperTab; label: string; icon: typeof FolderKanban }[] = [
  { id: 'projects', label: 'Проекты', icon: FolderKanban },
  { id: 'tasks', label: 'Задачи', icon: Check },
  { id: 'architecture', label: 'Архитектурные заметки', icon: FileCode2 },
]

export default function DeveloperWorkspace({ workspace, query, filters, onQueryChange, onCreate, onOpenNode, selectedNodeId, architectureNoteToOpen, onArchitectureNoteOpenHandled }: DeveloperWorkspaceProps) {
  const updateNode = useWorkspaceStore((state) => state.updateNode)
  const addArchitectureNote = useWorkspaceStore((state) => state.addArchitectureNote)
  const [tab, setTab] = useState<DeveloperTab>('projects')
  const [taskLayout, setTaskLayout] = useState<TaskLayout>('kanban')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [projectFilter, setProjectFilter] = useState('all')
  const [taskStatusFilter, setTaskStatusFilter] = useState<DeveloperTaskStatus | 'all'>('all')
  const [noteTypeFilter, setNoteTypeFilter] = useState<ArchitectureNoteType | 'all'>('all')
  const [newNoteType, setNewNoteType] = useState<ArchitectureNoteType>('technical-decision')
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)

  const liveNodes = useMemo(() => workspace.nodes.filter((node) => !node.deletedAt), [workspace.nodes])
  const projects = useMemo(() => liveNodes
    .filter((node) => node.type === 'project' && matchesNode(node, query, filters))
    .sort((first, second) => first.title.localeCompare(second.title)), [liveNodes, query, filters])
  const tasks = useMemo(() => liveNodes
    .filter((node) => node.type === 'task' && matchesNode(node, query, filters))
    .filter((node) => projectFilter === 'all' || (projectFilter === 'unassigned' ? !node.projectId : node.projectId === projectFilter))
    .filter((node) => taskStatusFilter === 'all' || getTaskStatus(node) === taskStatusFilter)
    .sort((first, second) => {
      const firstDue = first.dueDate || '9999-12-31'
      const secondDue = second.dueDate || '9999-12-31'
      return firstDue.localeCompare(secondDue) || first.title.localeCompare(second.title)
    }), [liveNodes, query, filters, projectFilter, taskStatusFilter])
  const notes = useMemo(() => workspace.architectureNotes
    .filter((note) => noteTypeFilter === 'all' || note.type === noteTypeFilter)
    .filter((note) => matchesArchitectureNote(note, query))
    .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt)), [workspace.architectureNotes, noteTypeFilter, query])

  const selectedProject = liveNodes.find((node) => node.id === selectedProjectId && node.type === 'project') ?? null
  const selectedTask = liveNodes.find((node) => node.id === selectedTaskId && node.type === 'task') ?? null
  const selectedNote = workspace.architectureNotes.find((note) => note.id === selectedNoteId) ?? null
  const taskCount = liveNodes.filter((node) => node.type === 'task').length

  useEffect(() => {
    if (!selectedNodeId) return
    const selectedNode = liveNodes.find((node) => node.id === selectedNodeId)
    if (selectedNode?.type === 'project') {
      setSelectedProjectId(selectedNode.id)
      setTab('projects')
    } else if (selectedNode?.type === 'task') {
      setSelectedTaskId(selectedNode.id)
      setTab('tasks')
    }
  }, [selectedNodeId, liveNodes])

  useEffect(() => {
    if (!architectureNoteToOpen) return
    setSelectedNoteId(architectureNoteToOpen)
    setTab('architecture')
    onArchitectureNoteOpenHandled?.()
  }, [architectureNoteToOpen, onArchitectureNoteOpenHandled])

  const createProject = () => {
    onCreate('project')
    const id = useWorkspaceStore.getState().selectedNodeId
    if (!id) return
    updateNode(id, { projectStatus: 'idea', techStack: [], repositoryUrl: '', demoUrl: '' })
    setSelectedProjectId(id)
    setTab('projects')
  }

  const createTask = (forProjectId?: string | null) => {
    onCreate('task')
    const id = useWorkspaceStore.getState().selectedNodeId
    if (!id) return
    const projectId = forProjectId ?? (projectFilter !== 'all' && projectFilter !== 'unassigned' ? projectFilter : projects[0]?.id ?? null)
    updateNode(id, { taskStatus: 'backlog', dueDate: null, projectId })
    setSelectedTaskId(id)
    setTab('tasks')
  }

  const createNote = (type: ArchitectureNoteType = newNoteType, projectId?: string | null) => {
    const note = addArchitectureNote(type, projectId ?? selectedProjectId)
    if (!note) return
    setSelectedNoteId(note.id)
    setTab('architecture')
  }

  const moveTask = (id: string, status: DeveloperTaskStatus) => {
    updateNode(id, { taskStatus: status, status: toNodeStatus(status) })
  }

  return (
    <div className="content-page developer-page">
      <header className="developer-header">
        <div>
          <span className="eyebrow">РАЗРАБОТКА С КОНТЕКСТОМ</span>
          <h1>Разработка</h1>
          <p>Проекты, задачи и архитектурные решения — в одном месте и на вашем устройстве.</p>
        </div>
        <div className="developer-header__stats" aria-label="Сводка по рабочему пространству разработки">
          <span><FolderKanban size={14} /> {formatRussianCount(projects.length, { one: 'проект', few: 'проекта', many: 'проектов' })}</span>
          <span><Check size={14} /> {formatRussianCount(taskCount, { one: 'задача', few: 'задачи', many: 'задач' })}</span>
          <span><FileText size={14} /> {formatRussianCount(workspace.architectureNotes.length, { one: 'заметка', few: 'заметки', many: 'заметок' })}</span>
        </div>
      </header>

      <div className="developer-toolbar">
        <label className="developer-search">
          <Search size={14} />
          <input
            type="search"
            aria-label="Поиск по разделу разработки"
            placeholder="Поиск по проектам, задачам, решениям и заметкам"
            value={query}
            onChange={(event) => onQueryChange?.(event.target.value)}
          />
          {query && <button aria-label="Очистить поиск по разделу разработки" onClick={() => onQueryChange?.('')}><X size={13} /></button>}
        </label>
        {tab === 'projects' && <button className="button-primary" onClick={createProject}><Plus size={15} /> Новый проект</button>}
        {tab === 'tasks' && <button className="button-primary" onClick={() => createTask()}><Plus size={15} /> Новая задача</button>}
        {tab === 'architecture' && <div className="developer-create-note">
          <label>
            <span className="visually-hidden">Тип новой архитектурной заметки</span>
            <select aria-label="Тип новой архитектурной заметки" value={newNoteType} onChange={(event) => setNewNoteType(event.target.value as ArchitectureNoteType)}>
              {architectureNoteTypes.map((type) => <option key={type} value={type}>{architectureNoteTypeLabels[type]}</option>)}
            </select>
          </label>
          <button className="button-primary" onClick={() => createNote()}><Plus size={15} /> Новая заметка</button>
        </div>}
      </div>

      <div className="developer-tabs" role="tablist" aria-label="Разделы разработки">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            id={`developer-tab-${id}`}
            role="tab"
            aria-selected={tab === id}
            aria-controls={`developer-panel-${id}`}
            onClick={() => setTab(id)}
          >
            <Icon size={14} />{label}
            <span>{id === 'projects' ? projects.length : id === 'tasks' ? taskCount : workspace.architectureNotes.length}</span>
          </button>
        ))}
      </div>

      {tab === 'projects' && (
        <section id="developer-panel-projects" className="developer-panel" role="tabpanel" aria-labelledby="developer-tab-projects">
          <div className={`developer-split developer-split--projects${selectedProject ? ' has-selection' : ''}`}>
            <div className="developer-project-grid" aria-label="Проекты разработки">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  taskCount={liveNodes.filter((node) => node.type === 'task' && node.projectId === project.id).length}
                  selected={selectedProjectId === project.id}
                  onSelect={() => setSelectedProjectId(project.id)}
                  onOpen={() => onOpenNode(project.id)}
                />
              ))}
              {projects.length === 0 && (
                <EmptyDeveloperState
                  icon={<FolderKanban size={21} />}
                  title={query ? 'Проекты не найдены' : 'Начните с проекта'}
                  description={query ? 'Измените запрос или очистите поиск по рабочему пространству.' : 'Добавьте проект, чтобы собрать в нём задачи, ссылки, технологии и решения.'}
                  action={!query ? <button className="button-primary" onClick={createProject}><Plus size={14} /> Создать проект</button> : undefined}
                />
              )}
            </div>
            {selectedProject && (
              <ProjectDetails
                key={selectedProject.id}
                project={selectedProject}
                workspace={workspace}
                tasks={liveNodes.filter((node) => node.type === 'task' && node.projectId === selectedProject.id)}
                onOpenNode={onOpenNode}
                onOpenTask={(id) => { setSelectedTaskId(id); setTab('tasks') }}
                onCreateTask={() => createTask(selectedProject.id)}
                onCreateDecision={() => createNote('technical-decision', selectedProject.id)}
                onClose={() => setSelectedProjectId(null)}
              />
            )}
          </div>
        </section>
      )}

      {tab === 'tasks' && (
        <section id="developer-panel-tasks" className="developer-panel" role="tabpanel" aria-labelledby="developer-tab-tasks">
          <div className="developer-task-controls">
            <label>
              <span>ПРОЕКТ</span>
              <select aria-label="Фильтр задач по проекту" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
                <option value="all">Все проекты</option>
                <option value="unassigned">Без проекта</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
              </select>
            </label>
            <label>
              <span>СТАТУС</span>
              <select aria-label="Фильтр задач по статусу" value={taskStatusFilter} onChange={(event) => setTaskStatusFilter(event.target.value as DeveloperTaskStatus | 'all')}>
                <option value="all">Все статусы</option>
                {developerTaskStatuses.map((status) => <option key={status} value={status}>{developerTaskStatusLabels[status]}</option>)}
              </select>
            </label>
            <div className="developer-view-toggle" role="group" aria-label="Вид задач">
              <button aria-label="Список задач" aria-pressed={taskLayout === 'list'} onClick={() => setTaskLayout('list')}><List size={14} /> Список</button>
              <button aria-label="Доска задач" aria-pressed={taskLayout === 'kanban'} onClick={() => setTaskLayout('kanban')}><Columns3 size={14} /> Канбан</button>
            </div>
            <span className="developer-task-result-count">{formatRussianCount(tasks.length, { one: 'задача', few: 'задачи', many: 'задач' })}</span>
          </div>
          <div className={`developer-split developer-split--tasks${selectedTask ? ' has-selection' : ''}`}>
            <div className="developer-task-results">
              {taskLayout === 'list' ? (
                <TaskList
                  tasks={tasks}
                  projects={projects}
                  selectedTaskId={selectedTaskId}
                  onSelect={setSelectedTaskId}
                  onOpenNode={onOpenNode}
                  onStatusChange={moveTask}
                />
              ) : (
                <TaskKanban
                  tasks={tasks}
                  projects={projects}
                  draggedTaskId={draggedTaskId}
                  onDragStart={setDraggedTaskId}
                  onDragEnd={() => setDraggedTaskId(null)}
                  onDrop={moveTask}
                  onSelect={setSelectedTaskId}
                  onOpenNode={onOpenNode}
                  onStatusChange={moveTask}
                />
              )}
              {tasks.length === 0 && (
                <EmptyDeveloperState
                  icon={<Check size={21} />}
                  title={query || projectFilter !== 'all' || taskStatusFilter !== 'all' ? 'Задачи не найдены' : 'Задач пока нет'}
                  description="Создайте задачу, назначьте проект и отслеживайте её путь от очереди до завершения."
                  action={<button className="button-primary" onClick={() => createTask()}><Plus size={14} /> Создать задачу</button>}
                />
              )}
            </div>
            {selectedTask && (
              <TaskDetails
                key={selectedTask.id}
                task={selectedTask}
                workspace={workspace}
                projects={liveNodes.filter((node) => node.type === 'project')}
                onOpenNode={onOpenNode}
                onClose={() => setSelectedTaskId(null)}
              />
            )}
          </div>
        </section>
      )}

      {tab === 'architecture' && (
        <section id="developer-panel-architecture" className="developer-panel" role="tabpanel" aria-labelledby="developer-tab-architecture">
          <div className="developer-architecture-controls">
            <label>
              <span>ТИП ЗАМЕТКИ</span>
              <select aria-label="Фильтр архитектурных заметок по типу" value={noteTypeFilter} onChange={(event) => setNoteTypeFilter(event.target.value as ArchitectureNoteType | 'all')}>
                <option value="all">Все типы заметок</option>
                {architectureNoteTypes.map((type) => <option key={type} value={type}>{architectureNoteTypeLabels[type]}</option>)}
              </select>
            </label>
            <span>{formatRussianCount(notes.length, { one: 'заметка', few: 'заметки', many: 'заметок' })}</span>
            <p><ShieldCheck size={13} /> Код хранится как текст, безопасно отображается и никогда не запускается.</p>
          </div>
          <div className={`developer-split developer-split--architecture${selectedNote ? ' has-selection' : ''}`}>
            <div className="developer-note-list" aria-label="Архитектурные заметки">
              {notes.map((note) => (
                <ArchitectureNoteCard
                  key={note.id}
                  note={note}
                  projectName={liveNodes.find((node) => node.id === note.projectId)?.title ?? null}
                  selected={selectedNoteId === note.id}
                  onSelect={() => setSelectedNoteId(note.id)}
                />
              ))}
              {notes.length === 0 && (
                <EmptyDeveloperState
                  icon={<FileCode2 size={21} />}
                  title={query || noteTypeFilter !== 'all' ? 'Заметки не найдены' : 'Запишите решение или техническую заметку'}
                  description="Сохраняйте архитектурные пояснения, сведения об API, ссылки на документацию, алгоритмы, фрагменты кода и вопросы для изучения."
                  action={<button className="button-primary" onClick={() => createNote()}><Plus size={14} /> Создать заметку</button>}
                />
              )}
            </div>
            {selectedNote && (
              <ArchitectureNoteDetails
                key={selectedNote.id}
                note={selectedNote}
                projects={liveNodes.filter((node) => node.type === 'project')}
                nodes={liveNodes.filter((node) => node.id !== selectedNote.id)}
                onOpenNode={onOpenNode}
                onClose={() => setSelectedNoteId(null)}
              />
            )}
          </div>
        </section>
      )}
    </div>
  )
}

function ProjectCard({ project, taskCount, selected, onSelect, onOpen }: {
  project: CanvasNodeData
  taskCount: number
  selected: boolean
  onSelect: () => void
  onOpen: () => void
}) {
  const status = getProjectStatus(project)
  return (
    <article className={`developer-project-card${selected ? ' is-selected' : ''}`}>
      <button className="developer-project-card__main" onClick={onSelect} aria-label={`Просмотреть проект «${project.title}»`}>
        <span className="developer-project-card__top"><span className={`developer-project-status developer-project-status--${status}`}>{projectStatusLabels[status]}</span><span className="developer-project-card__task-count"><Check size={12} /> {taskCount}</span></span>
        <strong>{project.title}</strong>
        <span className="developer-project-card__description">{project.description || 'Описания проекта пока нет.'}</span>
      </button>
      <div className="developer-project-card__stack">{(project.techStack ?? []).slice(0, 4).map((item) => <span key={item}>{item}</span>)}{!(project.techStack?.length) && <span className="is-empty">Добавьте технологии</span>}</div>
      <div className="developer-project-card__footer">
        <span><CalendarDays size={12} /> Изменено {formatShortDate(project.updatedAt)}</span>
        <button aria-label={`Открыть проект «${project.title}» на холсте`} title="Открыть на холсте" onClick={onOpen}><ArrowRight size={13} /></button>
      </div>
    </article>
  )
}

function ProjectDetails({ project, workspace, tasks, onOpenNode, onOpenTask, onCreateTask, onCreateDecision, onClose }: {
  project: CanvasNodeData
  workspace: Workspace
  tasks: CanvasNodeData[]
  onOpenNode: (id: string) => void
  onOpenTask: (id: string) => void
  onCreateTask: () => void
  onCreateDecision: () => void
  onClose: () => void
}) {
  const updateNode = useWorkspaceStore((state) => state.updateNode)
  const addEdge = useWorkspaceStore((state) => state.addEdge)
  const [titleDraft, setTitleDraft] = useState(project.title)
  const [stackDraft, setStackDraft] = useState('')
  const [relatedDraft, setRelatedDraft] = useState('')

  const connectedNodes = useMemo(() => {
    const ids = new Set(workspace.edges.flatMap((edge) => edge.sourceId === project.id ? [edge.targetId] : edge.targetId === project.id ? [edge.sourceId] : []))
    return workspace.nodes.filter((node) => ids.has(node.id) && !node.deletedAt && node.id !== project.id)
  }, [project.id, workspace.edges, workspace.nodes])
  const candidateNodes = workspace.nodes.filter((node) => !node.deletedAt && node.id !== project.id && node.type !== 'project' && node.type !== 'task' && !connectedNodes.some((related) => related.id === node.id))
  const architectureDecisions = workspace.architectureNotes.filter((note) => note.projectId === project.id && note.type === 'technical-decision')
  const projectStatus = getProjectStatus(project)

  const updateTitle = (value: string) => {
    setTitleDraft(value)
    if (value.trim()) updateNode(project.id, { title: value })
  }
  const commitTitle = () => {
    const value = titleDraft.trim() || 'Новый проект'
    setTitleDraft(value)
    if (value !== project.title) updateNode(project.id, { title: value })
  }
  const addStackItem = (event?: FormEvent | KeyboardEvent) => {
    event?.preventDefault()
    const value = stackDraft.trim().slice(0, 48)
    const stack = project.techStack ?? []
    if (!value) return
    if (stack.length < 30 && !stack.some((item) => item.toLocaleLowerCase() === value.toLocaleLowerCase())) {
      updateNode(project.id, { techStack: [...stack, value] })
    }
    setStackDraft('')
  }
  const addRelatedNode = () => {
    if (!relatedDraft) return
    addEdge(project.id, relatedDraft, 'references', 'Ссылка на проект')
    setRelatedDraft('')
  }
  const repositoryUrl = safeWebUrl(project.repositoryUrl)
  const demoUrl = safeWebUrl(project.demoUrl)

  return (
    <aside className="developer-detail-panel developer-project-details" aria-label={`Сведения о проекте «${project.title}»`}>
      <div className="developer-detail-panel__header">
        <div><span className="eyebrow">СВЕДЕНИЯ О ПРОЕКТЕ</span><span className="developer-detail-panel__meta">Создано {formatDate(project.createdAt)}</span></div>
        <button className="icon-button" aria-label="Закрыть сведения о проекте" onClick={onClose}><X size={15} /></button>
      </div>
      <div className="developer-detail-panel__body">
        <label className="developer-field"><span>НАЗВАНИЕ ПРОЕКТА</span><input aria-label="Название проекта" value={titleDraft} maxLength={180} onChange={(event) => updateTitle(event.target.value)} onBlur={commitTitle} /></label>
        <label className="developer-field"><span>ОПИСАНИЕ</span><textarea aria-label="Описание проекта" value={project.description} maxLength={5000} rows={3} onChange={(event) => updateNode(project.id, { description: event.target.value })} /></label>
        <label className="developer-field"><span>СТАТУС</span><select aria-label="Статус проекта" value={projectStatus} onChange={(event) => updateNode(project.id, { projectStatus: event.target.value as ProjectStatus })}>{projectStatuses.map((status) => <option key={status} value={status}>{projectStatusLabels[status]}</option>)}</select></label>

        <section className="developer-editor-section">
          <div className="developer-editor-section__heading"><h3>Технологии</h3><span>{(project.techStack ?? []).length}/30</span></div>
          <div className="developer-chip-list">
            {(project.techStack ?? []).map((item) => <span className="developer-chip" key={item}>{item}<button aria-label={`Удалить «${item}» из списка технологий`} onClick={() => updateNode(project.id, { techStack: (project.techStack ?? []).filter((stackItem) => stackItem !== item) })}><X size={10} /></button></span>)}
            {!(project.techStack?.length) && <span className="developer-muted">Технологии пока не добавлены.</span>}
          </div>
          <form className="developer-add-row" onSubmit={(event) => addStackItem(event)}>
            <input aria-label="Добавить технологию" placeholder="Например, React, TypeScript…" maxLength={48} value={stackDraft} onChange={(event) => setStackDraft(event.target.value)} onBlur={() => { if (stackDraft.trim()) addStackItem() }} disabled={(project.techStack ?? []).length >= 30} />
            <button className="icon-button" aria-label="Добавить технологию в список" disabled={!stackDraft.trim() || (project.techStack ?? []).length >= 30}><Plus size={13} /></button>
          </form>
        </section>

        <div className="developer-link-fields">
          <label className="developer-field"><span>АДРЕС РЕПОЗИТОРИЯ</span><input aria-label="Адрес репозитория" type="url" maxLength={2048} placeholder="https://github.com/…" value={project.repositoryUrl ?? ''} onChange={(event) => updateNode(project.id, { repositoryUrl: event.target.value })} /></label>
          <label className="developer-field"><span>АДРЕС ДЕМО-ВЕРСИИ</span><input aria-label="Адрес демо-версии" type="url" maxLength={2048} placeholder="https://…" value={project.demoUrl ?? ''} onChange={(event) => updateNode(project.id, { demoUrl: event.target.value })} /></label>
        </div>
        <div className="developer-project-links">
          {repositoryUrl ? <a href={repositoryUrl} target="_blank" rel="noreferrer"><GitBranch size={13} /> Репозиторий <ExternalLink size={11} /></a> : <span><GitBranch size={13} /> Репозиторий не указан</span>}
          {demoUrl ? <a href={demoUrl} target="_blank" rel="noreferrer"><Sparkles size={13} /> Демо-версия <ExternalLink size={11} /></a> : <span><Sparkles size={13} /> Демо-версия не указана</span>}
        </div>

        <section className="developer-editor-section">
          <div className="developer-editor-section__heading"><h3>Задачи проекта</h3><span>{tasks.length}</span></div>
          {tasks.length > 0 ? <div className="developer-related-list">{tasks.map((task) => (
            <button key={task.id} className="developer-related-item" onClick={() => onOpenTask(task.id)}>
              <span className="developer-related-item__glyph"><Check size={13} /></span><span><strong>{task.title}</strong><small>{developerTaskStatusLabels[getTaskStatus(task)]}{task.dueDate ? ` · Срок: ${formatShortDate(task.dueDate)}` : ''}</small></span><ChevronRight size={13} />
            </button>
          ))}</div> : <p className="developer-muted">В проекте пока нет задач.</p>}
          <button className="developer-text-action" onClick={onCreateTask}><Plus size={13} /> Добавить задачу в проект</button>
        </section>

        <section className="developer-editor-section">
          <div className="developer-editor-section__heading"><h3>Архитектурные решения</h3><span>{architectureDecisions.length}</span></div>
          {architectureDecisions.length > 0 ? <div className="developer-related-list">{architectureDecisions.map((note) => (
            <div className="developer-related-item developer-related-item--static" key={note.id}><span className="developer-related-item__glyph"><FileText size={13} /></span><span><strong>{note.title}</strong><small>{architectureNoteTypeLabels[note.type]}</small></span></div>
          ))}</div> : <p className="developer-muted">Здесь появятся решения, связанные с проектом.</p>}
          <button className="developer-text-action" onClick={onCreateDecision}><Plus size={13} /> Записать решение</button>
        </section>

        <section className="developer-editor-section">
          <div className="developer-editor-section__heading"><h3>Связанные знания и идеи</h3><span>{connectedNodes.length}</span></div>
          {connectedNodes.length > 0 ? <div className="developer-related-list">{connectedNodes.map((node) => {
            const edge = workspace.edges.find((item) => (item.sourceId === project.id && item.targetId === node.id) || (item.targetId === project.id && item.sourceId === node.id))
            return <button key={node.id} className="developer-related-item" onClick={() => onOpenNode(node.id)}><span className="developer-related-item__glyph"><Network size={13} /></span><span><strong>{node.title}</strong><small>{kindLabels[node.type]}{edge ? ` · ${getRelationCaption(edge)}` : ''}</small></span><ArrowRight size={12} /></button>
          })}</div> : <p className="developer-muted">Связанных идей и знаний пока нет.</p>}
          <div className="developer-add-row">
            <select aria-label="Выбрать идею или объект базы знаний для связи" value={relatedDraft} onChange={(event) => setRelatedDraft(event.target.value)}>
              <option value="">Связать с идеей или объектом базы знаний…</option>
              {candidateNodes.map((node) => <option key={node.id} value={node.id}>{kindLabels[node.type]} · {node.title}</option>)}
            </select>
            <button className="icon-button" aria-label="Связать с выбранной идеей или объектом базы знаний" onClick={addRelatedNode} disabled={!relatedDraft}><Link2 size={13} /></button>
          </div>
        </section>
        <div className="developer-updated-at"><CalendarDays size={12} /> Изменено {formatDate(project.updatedAt)}</div>
        <button className="developer-open-canvas" onClick={() => onOpenNode(project.id)}><ArrowRight size={13} /> Открыть проект на холсте</button>
      </div>
    </aside>
  )
}

function TaskList({ tasks, projects, selectedTaskId, onSelect, onOpenNode, onStatusChange }: {
  tasks: CanvasNodeData[]
  projects: CanvasNodeData[]
  selectedTaskId: string | null
  onSelect: (id: string) => void
  onOpenNode: (id: string) => void
  onStatusChange: (id: string, status: DeveloperTaskStatus) => void
}) {
  if (tasks.length === 0) return null
  return (
    <div className="developer-task-list" role="list" aria-label="Задачи разработки">
      <div className="developer-task-list__header" aria-hidden="true"><span>ЗАДАЧА</span><span>СТАТУС</span><span>ПРИОРИТЕТ</span><span>СРОК</span><span>ПРОЕКТ</span><span /></div>
      {tasks.map((task) => (
        <article className={`developer-task-row${selectedTaskId === task.id ? ' is-selected' : ''}`} role="listitem" key={task.id}>
          <button className="developer-task-row__main" onClick={() => onSelect(task.id)} aria-label={`Изменить задачу «${task.title}»`}>
            <strong>{task.title}</strong><span>{task.description || 'Описания задачи пока нет.'}</span>
          </button>
          <label className="visually-hidden" htmlFor={`task-status-${task.id}`}>Статус задачи «{task.title}»</label>
          <select id={`task-status-${task.id}`} aria-label={`Статус задачи «${task.title}»`} value={getTaskStatus(task)} onChange={(event) => onStatusChange(task.id, event.target.value as DeveloperTaskStatus)}>{developerTaskStatuses.map((status) => <option key={status} value={status}>{developerTaskStatusLabels[status]}</option>)}</select>
          <span className={`developer-priority developer-priority--${task.priority}`}>{priorityLabels[task.priority]}</span>
          <time className={task.dueDate && task.dueDate < todayString() ? 'is-overdue' : ''} dateTime={task.dueDate ?? undefined}>{task.dueDate ? formatShortDate(task.dueDate) : 'Без срока'}</time>
          <span className="developer-task-row__project">{projects.find((project) => project.id === task.projectId)?.title ?? 'Без проекта'}</span>
          <button className="icon-button" aria-label={`Открыть задачу «${task.title}» на холсте`} onClick={() => onOpenNode(task.id)}><ArrowRight size={13} /></button>
        </article>
      ))}
    </div>
  )
}

function TaskKanban({ tasks, projects, draggedTaskId, onDragStart, onDragEnd, onDrop, onSelect, onOpenNode, onStatusChange }: {
  tasks: CanvasNodeData[]
  projects: CanvasNodeData[]
  draggedTaskId: string | null
  onDragStart: (id: string) => void
  onDragEnd: () => void
  onDrop: (id: string, status: DeveloperTaskStatus) => void
  onSelect: (id: string) => void
  onOpenNode: (id: string) => void
  onStatusChange: (id: string, status: DeveloperTaskStatus) => void
}) {
  return (
    <div className="developer-kanban-board" aria-label="Доска задач Канбан">
      {developerTaskStatuses.map((status) => {
        const columnTasks = tasks.filter((task) => getTaskStatus(task) === status)
        return (
          <section
            key={status}
            className={`developer-kanban-column developer-kanban-column--${status}${draggedTaskId ? ' is-drop-ready' : ''}`}
            aria-label={`Задачи: ${developerTaskStatusLabels[status]}`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event: DragEvent<HTMLElement>) => {
              event.preventDefault()
              const id = event.dataTransfer?.getData('text/plain') || draggedTaskId
              if (id) onDrop(id, status)
              onDragEnd()
            }}
          >
            <header><span className={`developer-kanban-column__dot developer-kanban-column__dot--${status}`} /><h2>{developerTaskStatusLabels[status]}</h2><span className="developer-kanban-column__count">{columnTasks.length}</span></header>
            <div className="developer-kanban-column__cards">
              {columnTasks.map((task) => (
                <article
                  key={task.id}
                  className={`developer-task-card${draggedTaskId === task.id ? ' is-dragging' : ''}`}
                  draggable
                  aria-label={`Карточка задачи «${task.title}»`}
                  onDragStart={(event) => { event.dataTransfer?.setData('text/plain', task.id); if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'; onDragStart(task.id) }}
                  onDragEnd={onDragEnd}
                >
                  <div className="developer-task-card__top"><span className={`developer-priority developer-priority--${task.priority}`}>{priorityLabels[task.priority]}</span>{task.dueDate && <time className={task.dueDate < todayString() && getTaskStatus(task) !== 'done' ? 'is-overdue' : ''} dateTime={task.dueDate}><CalendarDays size={11} />{formatShortDate(task.dueDate)}</time>}</div>
                  <button className="developer-task-card__title" onClick={() => onSelect(task.id)}>{task.title}</button>
                  {task.description && <p>{task.description}</p>}
                  <div className="developer-task-card__footer"><span>{projects.find((project) => project.id === task.projectId)?.title ?? 'Без проекта'}</span><button className="icon-button" aria-label={`Открыть задачу «${task.title}» на холсте`} onClick={() => onOpenNode(task.id)}><ArrowRight size={12} /></button></div>
                  <label className="developer-card-status-label"><span>Переместить в статус</span><select aria-label={`Изменить статус задачи «${task.title}»`} value={status} onChange={(event) => onStatusChange(task.id, event.target.value as DeveloperTaskStatus)}>{developerTaskStatuses.map((nextStatus) => <option key={nextStatus} value={nextStatus}>{developerTaskStatusLabels[nextStatus]}</option>)}</select></label>
                </article>
              ))}
              {columnTasks.length === 0 && <p className="developer-kanban-column__empty">Перетащите задачу сюда</p>}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function TaskDetails({ task, workspace, projects, onOpenNode, onClose }: {
  task: CanvasNodeData
  workspace: Workspace
  projects: CanvasNodeData[]
  onOpenNode: (id: string) => void
  onClose: () => void
}) {
  const updateNode = useWorkspaceStore((state) => state.updateNode)
  const addEdge = useWorkspaceStore((state) => state.addEdge)
  const [titleDraft, setTitleDraft] = useState(task.title)
  const [tagDraft, setTagDraft] = useState('')
  const [relatedDraft, setRelatedDraft] = useState('')
  const taskStatus = getTaskStatus(task)
  const related = workspace.edges.flatMap((edge) => {
    const nodeId = edge.sourceId === task.id ? edge.targetId : edge.targetId === task.id ? edge.sourceId : null
    const node = nodeId ? workspace.nodes.find((item) => item.id === nodeId && !item.deletedAt) : null
    return node ? [{ edge, node }] : []
  })
  const relatedIds = new Set(related.map((item) => item.node.id))
  const candidates = workspace.nodes.filter((node) => !node.deletedAt && node.id !== task.id && !relatedIds.has(node.id))

  const commitTag = (event?: FormEvent | KeyboardEvent) => {
    event?.preventDefault()
    const value = tagDraft.trim().replace(/^#/, '').slice(0, 48)
    if (!value) return
    const latestTags = useWorkspaceStore.getState().workspace.nodes.find((node) => node.id === task.id)?.tags ?? task.tags
    if (latestTags.length < 20 && !latestTags.some((tag) => tag.toLocaleLowerCase() === value.toLocaleLowerCase())) updateNode(task.id, { tags: [...latestTags, value] })
    setTagDraft('')
  }
  const commitTitle = () => {
    const value = titleDraft.trim() || 'Новая задача'
    setTitleDraft(value)
    if (value !== task.title) updateNode(task.id, { title: value })
  }
  const addRelated = () => {
    if (!relatedDraft) return
    addEdge(task.id, relatedDraft, 'related_to', 'Контекст задачи')
    setRelatedDraft('')
  }

  return (
    <aside className="developer-detail-panel developer-task-details" aria-label={`Сведения о задаче «${task.title}»`}>
      <div className="developer-detail-panel__header"><div><span className="eyebrow">СВЕДЕНИЯ О ЗАДАЧЕ</span><span className="developer-detail-panel__meta">Создано {formatDate(task.createdAt)}</span></div><button className="icon-button" aria-label="Закрыть сведения о задаче" onClick={onClose}><X size={15} /></button></div>
      <div className="developer-detail-panel__body">
        <label className="developer-field"><span>НАЗВАНИЕ ЗАДАЧИ</span><input aria-label="Название задачи" value={titleDraft} maxLength={180} onChange={(event) => { setTitleDraft(event.target.value); if (event.target.value.trim()) updateNode(task.id, { title: event.target.value }) }} onBlur={commitTitle} /></label>
        <label className="developer-field"><span>ОПИСАНИЕ</span><textarea aria-label="Описание задачи" value={task.description} maxLength={5000} rows={3} onChange={(event) => updateNode(task.id, { description: event.target.value })} /></label>
        <div className="developer-task-detail-grid">
          <label className="developer-field"><span>СТАТУС</span><select aria-label="Статус задачи" value={taskStatus} onChange={(event) => { const nextStatus = event.target.value as DeveloperTaskStatus; updateNode(task.id, { taskStatus: nextStatus, status: toNodeStatus(nextStatus) }) }}>{developerTaskStatuses.map((status) => <option key={status} value={status}>{developerTaskStatusLabels[status]}</option>)}</select></label>
          <label className="developer-field"><span>ПРИОРИТЕТ</span><select aria-label="Приоритет задачи" value={task.priority} onChange={(event) => updateNode(task.id, { priority: event.target.value as NodePriority })}>{nodePriorities.map((priority) => <option key={priority} value={priority}>{priorityLabels[priority]}</option>)}</select></label>
        </div>
        <label className="developer-field"><span>СРОК</span><input aria-label="Срок выполнения задачи" type="date" value={task.dueDate ?? ''} onChange={(event) => updateNode(task.id, { dueDate: event.target.value || null })} /></label>
        <label className="developer-field"><span>ПРОЕКТ</span><select aria-label="Проект задачи" value={task.projectId ?? ''} onChange={(event) => updateNode(task.id, { projectId: event.target.value || null })}><option value="">Без проекта</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label>

        <section className="developer-editor-section">
          <div className="developer-editor-section__heading"><h3>Теги</h3><span>{task.tags.length}/20</span></div>
          <div className="developer-chip-list">{task.tags.map((tag) => <span className="developer-chip" key={tag}>#{tag}<button aria-label={`Удалить тег задачи «${tag}»`} onClick={() => updateNode(task.id, { tags: task.tags.filter((item) => item !== tag) })}><X size={10} /></button></span>)}{task.tags.length === 0 && <span className="developer-muted">Тегов пока нет.</span>}</div>
          <form className="developer-add-row" onSubmit={(event) => commitTag(event)}><input aria-label="Добавить тег задачи" placeholder="Добавить тег" maxLength={48} value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} onBlur={() => { if (tagDraft.trim()) commitTag() }} disabled={task.tags.length >= 20} /><button className="icon-button" aria-label="Добавить тег задачи" disabled={!tagDraft.trim() || task.tags.length >= 20}><Plus size={13} /></button></form>
        </section>

        <section className="developer-editor-section">
          <div className="developer-editor-section__heading"><h3>Связанные объекты</h3><span>{related.length}</span></div>
          {related.length > 0 ? <div className="developer-related-list">{related.map(({ edge, node }) => <button className="developer-related-item" key={edge.id} onClick={() => onOpenNode(node.id)}><span className="developer-related-item__glyph"><Network size={13} /></span><span><strong>{node.title}</strong><small>{kindLabels[node.type]} · {getRelationCaption(edge)}</small></span><ArrowRight size={12} /></button>)}</div> : <p className="developer-muted">Связей с объектами пока нет. Добавьте нужные связи ниже.</p>}
          <div className="developer-add-row"><select aria-label="Выбрать связанный объект для задачи" value={relatedDraft} onChange={(event) => setRelatedDraft(event.target.value)}><option value="">Выберите объект для связи…</option>{candidates.map((node) => <option key={node.id} value={node.id}>{kindLabels[node.type]} · {node.title}</option>)}</select><button className="icon-button" aria-label="Связать выбранный объект с задачей" onClick={addRelated} disabled={!relatedDraft}><Link2 size={13} /></button></div>
        </section>
        <div className="developer-updated-at"><CalendarDays size={12} /> Изменено {formatDate(task.updatedAt)}</div>
        <button className="developer-open-canvas" onClick={() => onOpenNode(task.id)}><ArrowRight size={13} /> Открыть задачу на холсте</button>
      </div>
    </aside>
  )
}

function ArchitectureNoteCard({ note, projectName, selected, onSelect }: {
  note: ArchitectureNote
  projectName: string | null
  selected: boolean
  onSelect: () => void
}) {
  return (
    <article className={`developer-note-card${selected ? ' is-selected' : ''}`}>
      <button className="developer-note-card__main" onClick={onSelect} aria-label={`Открыть архитектурную заметку «${note.title}»`}>
        <span className={`developer-note-type developer-note-type--${note.type}`}><NoteGlyph type={note.type} />{architectureNoteTypeLabels[note.type]}</span>
        <strong>{note.title}</strong>
        <span className="developer-note-card__content">{note.content || (note.code ? note.code : 'Сведения пока не добавлены.')}</span>
        <span className="developer-note-card__meta">{projectName ?? 'Всё рабочее пространство'} · Изменено {formatShortDate(note.updatedAt)}</span>
      </button>
      {note.code && <div className="developer-note-card__code" aria-label={`Предпросмотр кода (${note.codeLanguage})`}><code>{truncate(note.code, 180)}</code></div>}
    </article>
  )
}

function ArchitectureNoteDetails({ note, projects, nodes, onOpenNode, onClose }: {
  note: ArchitectureNote
  projects: CanvasNodeData[]
  nodes: CanvasNodeData[]
  onOpenNode: (id: string) => void
  onClose: () => void
}) {
  const updateArchitectureNote = useWorkspaceStore((state) => state.updateArchitectureNote)
  const deleteArchitectureNote = useWorkspaceStore((state) => state.deleteArchitectureNote)
  const [titleDraft, setTitleDraft] = useState(note.title)
  const [tagDraft, setTagDraft] = useState('')
  const [relatedDraft, setRelatedDraft] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const relatedNodes = note.relatedNodeIds.flatMap((id) => {
    const node = nodes.find((item) => item.id === id)
    return node ? [node] : []
  })
  const relatedIdSet = new Set(note.relatedNodeIds)
  const relatedCandidates = nodes.filter((node) => !relatedIdSet.has(node.id))

  const updateTitle = (value: string) => {
    setTitleDraft(value)
    if (value.trim()) updateArchitectureNote(note.id, { title: value })
  }
  const commitTitle = () => {
    const value = titleDraft.trim() || 'Новая архитектурная заметка'
    setTitleDraft(value)
    if (value !== note.title) updateArchitectureNote(note.id, { title: value })
  }
  const addTag = (event?: FormEvent | KeyboardEvent) => {
    event?.preventDefault()
    const value = tagDraft.trim().replace(/^#/, '').slice(0, 48)
    if (!value) return
    const current = useWorkspaceStore.getState().workspace.architectureNotes.find((item) => item.id === note.id)?.tags ?? note.tags
    if (current.length < 20 && !current.some((tag) => tag.toLocaleLowerCase() === value.toLocaleLowerCase())) updateArchitectureNote(note.id, { tags: [...current, value] })
    setTagDraft('')
  }
  const addRelated = () => {
    if (!relatedDraft) return
    updateArchitectureNote(note.id, { relatedNodeIds: [...note.relatedNodeIds, relatedDraft] })
    setRelatedDraft('')
  }
  const copyCode = async () => {
    setCopyFailed(false)
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(note.code)
      } else {
        const temporary = document.createElement('textarea')
        temporary.value = note.code
        temporary.setAttribute('readonly', '')
        temporary.style.position = 'fixed'
        temporary.style.opacity = '0'
        document.body.appendChild(temporary)
        temporary.select()
        const success = typeof document.execCommand === 'function' && document.execCommand('copy')
        temporary.remove()
        if (!success) throw new Error('Буфер обмена недоступен')
      }
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopyFailed(true)
    }
  }
  const safeUrl = safeWebUrl(note.url)
  const projectName = projects.find((project) => project.id === note.projectId)?.title

  return (
    <aside className="developer-detail-panel developer-note-details" aria-label={`Сведения об архитектурной заметке «${note.title}»`}>
      <div className="developer-detail-panel__header"><div><span className="eyebrow">АРХИТЕКТУРНАЯ ЗАМЕТКА</span><span className="developer-detail-panel__meta">Создано {formatDate(note.createdAt)}</span></div><button className="icon-button" aria-label="Закрыть сведения об архитектурной заметке" onClick={onClose}><X size={15} /></button></div>
      <div className="developer-detail-panel__body">
        <label className="developer-field"><span>НАЗВАНИЕ</span><input aria-label="Название архитектурной заметки" value={titleDraft} maxLength={180} onChange={(event) => updateTitle(event.target.value)} onBlur={commitTitle} /></label>
        <label className="developer-field"><span>ТИП ЗАМЕТКИ</span><select aria-label="Тип архитектурной заметки" value={note.type} onChange={(event) => updateArchitectureNote(note.id, { type: event.target.value as ArchitectureNoteType })}>{architectureNoteTypes.map((type) => <option key={type} value={type}>{architectureNoteTypeLabels[type]}</option>)}</select></label>
        <label className="developer-field"><span>ПРОЕКТ</span><select aria-label="Проект архитектурной заметки" value={note.projectId ?? ''} onChange={(event) => updateArchitectureNote(note.id, { projectId: event.target.value || null })}><option value="">Всё рабочее пространство</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label>
        <label className="developer-field"><span>СОДЕРЖАНИЕ</span><textarea aria-label="Содержание архитектурной заметки" value={note.content} maxLength={20000} rows={6} placeholder="Опишите решение, архитектуру, метод API, алгоритм или вопрос…" onChange={(event) => updateArchitectureNote(note.id, { content: event.target.value })} /></label>
        <label className="developer-field"><span>ССЫЛКА НА ДОКУМЕНТАЦИЮ</span><input aria-label="Адрес документации" type="url" maxLength={2048} placeholder="https://docs.example.com/…" value={note.url} onChange={(event) => updateArchitectureNote(note.id, { url: event.target.value })} /></label>
        {safeUrl && <a className="developer-doc-link" href={safeUrl} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Открыть документацию</a>}

        {(note.type === 'code' || note.code.length > 0) && <section className="developer-editor-section developer-code-editor-section">
          <div className="developer-editor-section__heading"><h3>Фрагмент кода</h3><span>Только отображение</span></div>
          <label className="developer-field"><span>ЯЗЫК</span><input aria-label="Язык программирования" maxLength={40} value={note.codeLanguage} onChange={(event) => updateArchitectureNote(note.id, { codeLanguage: event.target.value || 'text' })} /></label>
          <label className="developer-field"><span>КОД</span><textarea className="developer-code-input" aria-label="Исходный код фрагмента" value={note.code} maxLength={50000} rows={8} placeholder="Вставьте фрагмент кода для справки. Он не будет запущен." onChange={(event) => updateArchitectureNote(note.id, { code: event.target.value })} /></label>
          <div className="developer-code-safety-note"><ShieldCheck size={13} /> Этот код никогда не запускается.</div>
          {note.code && <div className="developer-code-block"><div className="developer-code-block__toolbar"><span>{note.codeLanguage || 'text'}</span><button onClick={() => void copyCode()}><Copy size={12} />{copied ? 'Скопировано' : 'Копировать код'}</button></div><pre><code>{note.code}</code></pre>{copyFailed && <span className="developer-copy-error" role="status">Не удалось скопировать. Выделите код и скопируйте его вручную.</span>}</div>}
        </section>}

        <section className="developer-editor-section">
          <div className="developer-editor-section__heading"><h3>Теги</h3><span>{note.tags.length}/20</span></div>
          <div className="developer-chip-list">{note.tags.map((tag) => <span className="developer-chip" key={tag}>#{tag}<button aria-label={`Удалить тег заметки «${tag}»`} onClick={() => updateArchitectureNote(note.id, { tags: note.tags.filter((item) => item !== tag) })}><X size={10} /></button></span>)}{note.tags.length === 0 && <span className="developer-muted">Тегов пока нет.</span>}</div>
          <form className="developer-add-row" onSubmit={(event) => addTag(event)}><input aria-label="Добавить тег архитектурной заметки" placeholder="Добавить тег" maxLength={48} value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} onBlur={() => { if (tagDraft.trim()) addTag() }} disabled={note.tags.length >= 20} /><button className="icon-button" aria-label="Добавить тег архитектурной заметки" disabled={!tagDraft.trim() || note.tags.length >= 20}><Plus size={13} /></button></form>
        </section>

        <section className="developer-editor-section">
          <div className="developer-editor-section__heading"><h3>Связанные объекты</h3><span>{relatedNodes.length}</span></div>
          {relatedNodes.map((node) => <div className="developer-related-row" key={node.id}><button className="developer-related-row__open" onClick={() => onOpenNode(node.id)}><span><strong>{node.title}</strong><small>{kindLabels[node.type]}</small></span><ArrowRight size={12} /></button><button className="icon-button" aria-label={`Убрать связь с объектом «${node.title}»`} onClick={() => updateArchitectureNote(note.id, { relatedNodeIds: note.relatedNodeIds.filter((id) => id !== node.id) })}><X size={12} /></button></div>)}
          {relatedNodes.length === 0 && <p className="developer-muted">Свяжите объект, чтобы быстро перейти к его контексту.</p>}
          <div className="developer-add-row"><select aria-label="Выбрать объект для связи с архитектурной заметкой" value={relatedDraft} onChange={(event) => setRelatedDraft(event.target.value)}><option value="">Связать с объектом графа…</option>{relatedCandidates.map((node) => <option key={node.id} value={node.id}>{kindLabels[node.type]} · {node.title}</option>)}</select><button className="icon-button" aria-label="Связать объект с архитектурной заметкой" onClick={addRelated} disabled={!relatedDraft}><Link2 size={13} /></button></div>
        </section>
        <div className="developer-updated-at"><CalendarDays size={12} /> {projectName ? `Проект: ${projectName}` : 'Всё рабочее пространство'} · Изменено {formatDate(note.updatedAt)}</div>
        {confirmDelete ? <div className="developer-delete-confirm"><span>Удалить эту заметку навсегда?</span><button onClick={() => { deleteArchitectureNote(note.id); onClose() }}>Удалить заметку</button><button onClick={() => setConfirmDelete(false)}>Отмена</button></div> : <button className="developer-delete-note" onClick={() => setConfirmDelete(true)}><Trash2 size={13} /> Удалить заметку</button>}
      </div>
    </aside>
  )
}

function NoteGlyph({ type }: { type: ArchitectureNoteType }) {
  if (type === 'code') return <Code2 size={12} />
  if (type === 'question') return <CircleHelp size={12} />
  if (type === 'documentation') return <BookOpen size={12} />
  if (type === 'api-endpoint') return <Link2 size={12} />
  return type === 'technical-decision' ? <Check size={12} /> : <Network size={12} />
}

function EmptyDeveloperState({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action?: React.ReactNode }) {
  return <div className="developer-empty-state">{icon}<h2>{title}</h2><p>{description}</p>{action}</div>
}

function matchesArchitectureNote(note: ArchitectureNote, query: string) {
  const value = query.trim().toLocaleLowerCase()
  if (!value) return true
  return [note.title, note.content, note.url, note.code, note.codeLanguage, ...note.tags]
    .some((field) => field.toLocaleLowerCase().includes(value))
}

function safeWebUrl(value?: string) {
  if (!value?.trim()) return null
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null
  } catch {
    return null
  }
}

function formatShortDate(value: string) {
  return formatRussianDate(value, { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDate(value: string) {
  return formatRussianDate(value, { dateStyle: 'medium', timeStyle: 'short' })
}

function todayString() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function truncate(value: string, limit: number) {
  return value.length > limit ? `${value.slice(0, limit)}…` : value
}
