import { useRef } from 'react'
import { Activity, BookOpen, CheckSquare2, Clock3, Code2, Filter, FolderKanban, LayoutDashboard, Network, PanelLeftClose, PanelLeftOpen, Search, ShieldCheck, StickyNote, Star, Trash2, X, CirclePlus } from 'lucide-react'
import type { WorkspaceFilters, WorkspaceView } from '../domain/model'
import { useDialogAccessibility } from '../hooks/useDialogAccessibility'
import { kindLabels, nodeKinds, nodeStatuses, statusLabels } from '../domain/model'
import { formatRussianCount } from '../utils/locale'

type SidebarProps = {
  activeView: WorkspaceView
  onChangeView: (view: WorkspaceView) => void
  onCreateNode: () => void
  workspaceName: string
  query: string
  onQueryChange: (query: string) => void
  filters: WorkspaceFilters
  onFiltersChange: (filters: WorkspaceFilters) => void
  onClearFilters: () => void
  resultCount: number
  collapsed: boolean
  onToggleCollapsed: () => void
  isOpen: boolean
  onClose: () => void
  taskCount: number
  notesCount: number
  favoriteCount: number
  trashCount: number
}

const primaryNav: { id: WorkspaceView; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Обзор', icon: LayoutDashboard },
  { id: 'canvas', label: 'Холст', icon: Network },
  { id: 'graph-intelligence', label: 'Анализ графа', icon: Activity },
  { id: 'knowledge', label: 'База знаний', icon: BookOpen },
  { id: 'developer', label: 'Разработка', icon: Code2 },
  { id: 'projects', label: 'Проекты', icon: FolderKanban },
  { id: 'tasks', label: 'Задачи', icon: CheckSquare2 },
  { id: 'notes', label: 'Заметки', icon: StickyNote },
]

const libraryNav: { id: WorkspaceView; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'recent', label: 'Недавние', icon: Clock3 },
  { id: 'favorites', label: 'Избранное', icon: Star },
  { id: 'trash', label: 'Корзина', icon: Trash2 },
]

export default function Sidebar({
  activeView,
  onChangeView,
  onCreateNode,
  workspaceName,
  query,
  onQueryChange,
  filters,
  onFiltersChange,
  onClearFilters,
  resultCount,
  collapsed,
  onToggleCollapsed,
  isOpen,
  onClose,
  taskCount,
  notesCount,
  favoriteCount,
  trashCount,
}: SidebarProps) {
  const sidebarRef = useRef<HTMLElement>(null)
  useDialogAccessibility(
    sidebarRef,
    () => sidebarRef.current?.querySelector<HTMLElement>('.sidebar__close') ?? sidebarRef.current?.querySelector<HTMLElement>('button, input, select') ?? null,
    onClose,
    isOpen,
  )
  const hasFilters = Boolean(query.trim()) || filters.kind !== 'all' || filters.status !== 'all'
  const goTo = (view: WorkspaceView) => {
    onChangeView(view)
    onClose()
  }

  return (
    <>
      {isOpen && <button className="mobile-nav-scrim" aria-label="Закрыть навигацию" onClick={onClose} />}
      <aside
        ref={sidebarRef}
        id="workspace-navigation"
        className={`sidebar${isOpen ? ' is-open' : ''}${collapsed ? ' is-collapsed' : ''}`}
        role={isOpen ? 'dialog' : undefined}
        aria-modal={isOpen ? 'true' : undefined}
        aria-label="Навигация по рабочему пространству"
        tabIndex={isOpen ? -1 : undefined}
      >
        <div className="sidebar__workspace">
          <div className="workspace-avatar"><span>Н</span><i /></div>
          <div className="sidebar__workspace-copy">
            <span className="sidebar__eyebrow">ВАШЕ ПРОСТРАНСТВО</span>
            <strong>{workspaceName}</strong>
          </div>
          <button className="icon-button sidebar__collapse" title={collapsed ? 'Развернуть боковую панель' : 'Свернуть боковую панель'} aria-label={collapsed ? 'Развернуть боковую панель' : 'Свернуть боковую панель'} aria-expanded={!collapsed} onClick={onToggleCollapsed}>
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
          <button className="icon-button sidebar__close" title="Закрыть навигацию" aria-label="Закрыть навигацию" onClick={onClose}>
            <X size={17} />
          </button>
        </div>

        <button className="sidebar__capture" onClick={onCreateNode} title="Быстрая запись (клавиша N / Т)">
          <span className="capture-icon"><CirclePlus size={16} /></span>
          <span>Быстрая запись</span>
          <span className="capture-shortcut">N / Т</span>
        </button>

        <div className="sidebar__discovery" aria-label="Поиск и фильтрация объектов рабочего пространства">
          <label className="sidebar__search-field">
            <Search size={14} aria-hidden="true" />
            <input
              type="search"
              aria-label="Поиск по рабочему пространству"
              placeholder="Поиск по рабочему пространству"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
            />
            {query && <button type="button" aria-label="Очистить поиск по рабочему пространству" onClick={() => onQueryChange('')}><X size={12} /></button>}
          </label>
          <div className="sidebar__filter-heading"><Filter size={11} /><span>ФИЛЬТРЫ</span></div>
          <div className="sidebar__filter-row">
            <label>
              <span className="visually-hidden">Фильтр по типу</span>
              <select aria-label="Фильтр по типу" value={filters.kind} onChange={(event) => onFiltersChange({ ...filters, kind: event.target.value as WorkspaceFilters['kind'] })}>
                <option value="all">Все типы</option>
                {nodeKinds.map((kind) => <option key={kind} value={kind}>{kindLabels[kind]}</option>)}
              </select>
            </label>
            <label>
              <span className="visually-hidden">Фильтр по статусу</span>
              <select aria-label="Фильтр по статусу" value={filters.status} onChange={(event) => onFiltersChange({ ...filters, status: event.target.value as WorkspaceFilters['status'] })}>
                <option value="all">Все статусы</option>
                {nodeStatuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
              </select>
            </label>
          </div>
          {hasFilters && <div className="sidebar__filter-summary"><span>{formatRussianCount(resultCount, { one: 'подходящий элемент', few: 'подходящих элемента', many: 'подходящих элементов' })}</span><button onClick={onClearFilters}>Сбросить</button></div>}
        </div>

        <div className="sidebar__section-label">РАБОЧЕЕ ПРОСТРАНСТВО</div>
        <nav className="sidebar__nav" aria-label="Разделы рабочего пространства">
          {primaryNav.map(({ id, label, icon: Icon }) => (
            <NavItem key={id} id={id} label={label} icon={Icon} activeView={activeView} count={id === 'tasks' ? taskCount : id === 'notes' ? notesCount : undefined} onClick={() => goTo(id)} />
          ))}
        </nav>

        <div className="sidebar__section-heading"><span className="sidebar__section-label">БИБЛИОТЕКА</span></div>
        <nav className="sidebar__nav sidebar__nav--library" aria-label="Библиотека и история">
          {libraryNav.map(({ id, label, icon: Icon }) => (
            <NavItem key={id} id={id} label={label} icon={Icon} activeView={activeView} count={id === 'favorites' ? favoriteCount : id === 'trash' ? trashCount : undefined} onClick={() => goTo(id)} />
          ))}
        </nav>

        <div className="sidebar__bottom">
          <div className="local-status-card">
            <span className="local-status-icon"><ShieldCheck size={14} /></span>
            <div>
              <strong>Локальное хранение</strong>
              <span>Ваши данные остаются на этом устройстве</span>
            </div>
            <span className="local-status-dot" />
          </div>
          <div className="sidebar__profile">
            <span className="profile-avatar">НХ</span>
            <span className="profile-copy"><strong>Личное пространство</strong><small>Хранится на этом устройстве</small></span>
          </div>
        </div>
      </aside>
    </>
  )
}

function NavItem({
  id,
  label,
  icon: Icon,
  activeView,
  count,
  onClick,
}: {
  id: WorkspaceView
  label: string
  icon: typeof LayoutDashboard
  activeView: WorkspaceView
  count?: number
  onClick: () => void
}) {
  return (
    <button
      className={`sidebar__nav-item${activeView === id ? ' is-active' : ''}`}
      onClick={onClick}
      aria-current={activeView === id ? 'page' : undefined}
      aria-label={label}
      title={label}
    >
      <Icon size={17} strokeWidth={1.8} />
      <span>{label}</span>
      {count !== undefined && count > 0 && <span className="nav-count">{count}</span>}
      {activeView === id && <span className="nav-active-dot" />}
    </button>
  )
}
