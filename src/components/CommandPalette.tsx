import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import {
  ArrowRight,
  BookOpen,
  CheckSquare2,
  Code2,
  Command,
  Download,
  FolderKanban,
  Lightbulb,
  Network,
  Search,
  Settings2,
  StickyNote,
  X,
} from 'lucide-react'
import {
  architectureNoteTypeLabels,
  developerTaskStatusLabels,
  getNodeContent,
  kindLabels,
  nodeTypes,
  priorityLabels,
  projectStatusLabels,
  statusLabels,
  type ArchitectureNote,
  type CanvasNodeData,
  type Workspace,
} from '../domain/model'
import { matchesNodeQuery } from '../utils/search'
import { useDialogAccessibility } from '../hooks/useDialogAccessibility'

type CommandPaletteProps = {
  workspace: Workspace
  query: string
  onQueryChange: (query: string) => void
  onClose: () => void
  onOpenNode: (id: string) => void
  onOpenArchitectureNote: (id: string) => void
  onCommand: (id: string, query: string) => void
}

type PaletteCommand = { id: string; label: string; description: string; icon: typeof Search; keywords: string[] }
type PaletteOption = { kind: 'command'; item: PaletteCommand } | { kind: 'node'; item: CanvasNodeData } | { kind: 'architecture'; item: ArchitectureNote }

const commands: PaletteCommand[] = [
  { id: 'create-idea', label: 'Создать идею', description: 'Быстро записать новую идею на холсте', icon: Lightbulb, keywords: ['создать', 'узел', 'мысль', 'идея'] },
  { id: 'create-project', label: 'Создать проект', description: 'Добавить проект в раздел разработки', icon: FolderKanban, keywords: ['создать', 'разработка', 'проект'] },
  { id: 'create-task', label: 'Создать задачу', description: 'Добавить задачу в список работы', icon: CheckSquare2, keywords: ['создать', 'дело', 'задача', 'план'] },
  { id: 'create-note', label: 'Создать заметку', description: 'Открыть новую заметку в редакторе Markdown', icon: StickyNote, keywords: ['создать', 'markdown', 'текст', 'заметка'] },
  { id: 'search-graph', label: 'Найти на холсте', description: 'Найти узлы и показать их на холсте', icon: Network, keywords: ['поиск', 'найти', 'холст', 'граф'] },
  { id: 'fit-graph', label: 'Показать весь граф', description: 'Разместить весь граф по центру холста', icon: Command, keywords: ['центр', 'масштаб', 'холст', 'показать'] },
  { id: 'export-workspace', label: 'Экспортировать рабочее пространство', description: 'Скачать локальную резервную копию в формате JSON', icon: Download, keywords: ['резервная копия', 'скачать', 'json', 'экспорт'] },
  { id: 'open-settings', label: 'Открыть настройки', description: 'Изменить параметры рабочего пространства или импортировать данные', icon: Settings2, keywords: ['параметры', 'переименовать', 'импорт', 'настройки'] },
]

export default function CommandPalette({ workspace, query, onQueryChange, onClose, onOpenNode, onOpenArchitectureNote, onCommand }: CommandPaletteProps) {
  const dialogRef = useRef<HTMLElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [typeFilter, setTypeFilter] = useState('all')
  const [activeIndex, setActiveIndex] = useState(0)

  const commandMatches = useMemo(() => commands.filter((command) => {
    if (!query.trim() || command.id === 'search-graph') return true
    const searchable = [command.label, command.description, ...command.keywords].join(' ').toLocaleLowerCase()
    return searchable.includes(query.trim().toLocaleLowerCase())
  }), [query])
  const nodeMatches = useMemo(() => workspace.nodes
    .filter((node) => !node.deletedAt && (typeFilter === 'all' || typeFilter === node.type))
    .filter((node) => matchesNodeQuery(node, query))
    .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt))
    .slice(0, query.trim() ? 12 : 5), [workspace.nodes, query, typeFilter])
  const architectureMatches = useMemo(() => workspace.architectureNotes
    .filter((note) => (typeFilter === 'all' || typeFilter === 'architecture-note') && matchesArchitectureNote(note, query))
    .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt))
    .slice(0, query.trim() ? 8 : 3), [workspace.architectureNotes, query, typeFilter])
  const options: PaletteOption[] = [
    ...commandMatches.map((item) => ({ kind: 'command' as const, item })),
    ...nodeMatches.map((item) => ({ kind: 'node' as const, item })),
    ...architectureMatches.map((item) => ({ kind: 'architecture' as const, item })),
  ]

  useDialogAccessibility(dialogRef, () => inputRef.current, onClose)
  useEffect(() => { setActiveIndex(0) }, [query, typeFilter])

  const execute = (option: PaletteOption) => {
    if (option.kind === 'command') onCommand(option.item.id, query)
    else if (option.kind === 'node') onOpenNode(option.item.id)
    else onOpenArchitectureNote(option.item.id)
    onClose()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => Math.min(index + 1, options.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const option = options[activeIndex]
      if (option) execute(option)
    }
  }

  const activeTitle = options[activeIndex]
    ? options[activeIndex]?.kind === 'command' ? options[activeIndex].item.label
      : options[activeIndex]?.kind === 'node' ? options[activeIndex].item.title
        : options[activeIndex]?.item.title
    : undefined

  return (
    <div className="command-palette-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section id="command-palette-dialog" ref={dialogRef} className="command-palette" role="dialog" aria-modal="true" aria-labelledby="command-palette-title" tabIndex={-1}>
        <h2 id="command-palette-title" className="visually-hidden">Поиск и команды</h2>
        <div className="command-palette__search">
          <Search size={17} />
          <input ref={inputRef} role="searchbox" aria-label="Поиск по холсту" aria-controls="command-palette-results" aria-expanded={options.length > 0} placeholder="Найдите объект или выберите действие…" value={query} onChange={(event) => onQueryChange(event.target.value)} onKeyDown={handleKeyDown} aria-activedescendant={activeTitle ? `palette-option-${activeIndex}` : undefined} />
          <span className="command-palette__shortcut"><kbd>↑</kbd><kbd>↓</kbd><kbd>↵</kbd></span>
          <button className="icon-button" aria-label="Закрыть поиск и команды" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="command-palette__filters">
          <span><Command size={12} /> КОМАНДЫ И РЕЗУЛЬТАТЫ</span>
          <label><span className="visually-hidden">Фильтр результатов по типу</span><select aria-label="Фильтр результатов по типу" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">Все типы</option>{nodeTypes.map((type) => <option key={type} value={type}>{kindLabels[type]}</option>)}<option value="architecture-note">Архитектурные заметки</option></select></label>
        </div>
        <div className="command-palette__results">
          <div id="command-palette-results" role="listbox" aria-label="Результаты поиска и команды" aria-busy="false">
          {commandMatches.length > 0 && <div className="command-palette__group" role="group" aria-label="Быстрые действия"><span className="command-palette__group-label">БЫСТРЫЕ ДЕЙСТВИЯ</span>{commandMatches.map((command) => {
            const optionIndex = options.findIndex((option) => option.kind === 'command' && option.item.id === command.id)
            const Icon = command.icon
            return <button id={`palette-option-${optionIndex}`} role="option" aria-selected={activeIndex === optionIndex} className={`command-palette__option${activeIndex === optionIndex ? ' is-active' : ''}`} key={command.id} onMouseEnter={() => setActiveIndex(optionIndex)} onClick={() => execute({ kind: 'command', item: command })}><span className="command-palette__option-icon"><Icon size={15} /></span><span className="command-palette__option-copy"><strong><Highlight text={command.label} query={query} /></strong><small>{command.description}</small></span><ArrowRight size={13} /></button>
          })}</div>}

          {nodeMatches.length > 0 && <div className="command-palette__group" role="group" aria-label="Объекты рабочего пространства"><span className="command-palette__group-label">ОБЪЕКТЫ <small>{nodeMatches.length}</small></span>{nodeMatches.map((node) => {
            const optionIndex = options.findIndex((option) => option.kind === 'node' && option.item.id === node.id)
            return <button id={`palette-option-${optionIndex}`} role="option" aria-selected={activeIndex === optionIndex} className={`command-palette__option${activeIndex === optionIndex ? ' is-active' : ''}`} key={node.id} onMouseEnter={() => setActiveIndex(optionIndex)} onClick={() => execute({ kind: 'node', item: node })}><span className={`command-palette__option-icon command-palette__option-icon--${node.type}`}><ObjectGlyph type={node.type} /></span><span className="command-palette__option-copy"><strong><Highlight text={node.title} query={query} /></strong><small><Highlight text={kindLabels[node.type]} query={query} /> · <Highlight text={getNodeSearchContext(node, query)} query={query} /></small></span><ArrowRight size={13} /></button>
          })}</div>}

          {architectureMatches.length > 0 && <div className="command-palette__group" role="group" aria-label="Архитектурные заметки"><span className="command-palette__group-label">АРХИТЕКТУРНЫЕ ЗАМЕТКИ <small>{architectureMatches.length}</small></span>{architectureMatches.map((note) => {
            const optionIndex = options.findIndex((option) => option.kind === 'architecture' && option.item.id === note.id)
            const projectName = workspace.nodes.find((node) => node.id === note.projectId)?.title
            return <button id={`palette-option-${optionIndex}`} role="option" aria-selected={activeIndex === optionIndex} className={`command-palette__option${activeIndex === optionIndex ? ' is-active' : ''}`} key={note.id} onMouseEnter={() => setActiveIndex(optionIndex)} onClick={() => execute({ kind: 'architecture', item: note })}><span className="command-palette__option-icon"><FileCodeIcon /></span><span className="command-palette__option-copy"><strong><Highlight text={note.title} query={query} /></strong><small><Highlight text={architectureNoteTypeLabels[note.type]} query={query} />{projectName ? ` · ${projectName}` : ''} · <Highlight text={getArchitectureSearchContext(note, query)} query={query} /></small></span><ArrowRight size={13} /></button>
          })}</div>}
          </div>

          {query.trim() && nodeMatches.length === 0 && architectureMatches.length === 0 && <div className="command-palette__empty" role="status"><Search size={17} aria-hidden="true" /><strong>Совпадений в рабочем пространстве нет</strong><span>Измените запрос или выберите другой тип.</span></div>}
          {options.length === 0 && <div className="command-palette__empty" role="status"><Search size={17} aria-hidden="true" /><strong>Ничего не найдено</strong><span>Измените запрос или выберите другой тип.</span></div>}
        </div>
        <footer className="command-palette__footer"><span>Открыть поиск: <kbd>⌘ / Ctrl</kbd> + <kbd>K / Л</kbd></span><span>Поиск учитывает названия, описания, теги и текст заметок.</span><button onClick={onClose}>Закрыть · Esc</button></footer>
      </section>
    </div>
  )
}

function Highlight({ text, query }: { text: string; query: string }) {
  const term = query.trim()
  if (!term || !text) return <>{text}</>
  const index = text.toLocaleLowerCase().indexOf(term.toLocaleLowerCase())
  if (index < 0) return <>{truncate(text, 130)}</>
  return <>{text.slice(0, index)}<mark className="command-highlight">{text.slice(index, index + term.length)}</mark>{truncate(text.slice(index + term.length), 130 - index)}</>
}

function ObjectGlyph({ type }: { type: CanvasNodeData['type'] }) {
  if (type === 'idea') return <Lightbulb size={14} />
  if (type === 'project') return <FolderKanban size={14} />
  if (type === 'task') return <CheckSquare2 size={14} />
  if (type === 'note') return <StickyNote size={14} />
  if (type === 'knowledge' || type === 'concept') return <BookOpen size={14} />
  return <Network size={14} />
}

function FileCodeIcon() {
  return <Code2 size={15} />
}

function matchesArchitectureNote(note: ArchitectureNote, query: string) {
  const term = query.trim().toLocaleLowerCase()
  if (!term) return true
  return [note.title, note.content, note.code, note.codeLanguage, note.url, architectureNoteTypeLabels[note.type], ...note.tags].some((value) => value.toLocaleLowerCase().includes(term))
}

function getNodeSearchContext(node: CanvasNodeData, query: string) {
  const content = [
    getNodeContent(node),
    ...node.tags.map((tag) => `#${tag}`),
    kindLabels[node.type],
    statusLabels[node.status],
    ...(node.techStack ?? []),
    node.projectStatus ? projectStatusLabels[node.projectStatus] : '',
    node.taskStatus ? developerTaskStatusLabels[node.taskStatus] : '',
    priorityLabels[node.priority],
    node.repositoryUrl ?? '',
    node.demoUrl ?? '',
    node.dueDate ?? '',
  ].filter(Boolean)
  return matchingExcerpt(content, query) || content[0] || 'Описание отсутствует'
}

function getArchitectureSearchContext(note: ArchitectureNote, query: string) {
  const content = [architectureNoteTypeLabels[note.type], note.content, note.code, note.url, note.codeLanguage, ...note.tags].filter(Boolean)
  return matchingExcerpt(content, query) || content[0] || architectureNoteTypeLabels[note.type]
}

function matchingExcerpt(values: string[], query: string) {
  const term = query.trim().toLocaleLowerCase()
  if (!term) return ''
  const match = values.find((value) => value.toLocaleLowerCase().includes(term))
  if (!match) return ''
  const index = match.toLocaleLowerCase().indexOf(term)
  return match.slice(Math.max(0, index - 55), Math.min(match.length, index + 120))
}

function truncate(value: string, limit: number) {
  const cleaned = value.replace(/\s+/g, ' ').trim()
  return cleaned.length > limit ? `${cleaned.slice(0, limit)}…` : cleaned
}
