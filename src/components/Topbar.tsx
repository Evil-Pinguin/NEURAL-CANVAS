import { AlertCircle, Check, ChevronDown, CircleHelp, Command, Download, Layers3, Menu, Plus, Search, Settings2, Upload, UserRound, Workflow } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { WorkspaceView, WorkspaceSettings } from '../domain/model'
import type { SaveStatus, WorkspaceSummary } from '../store/workspace-store'

type TopbarProps = {
  searchOpen: boolean
  onSearchOpen: () => void
  settingsRequest: number
  saveStatus: SaveStatus
  workspaceId: string
  workspaceName: string
  workspaceSettings: WorkspaceSettings
  workspaces: WorkspaceSummary[]
  actionsDisabled: boolean
  onSwitchWorkspace: (id: string) => Promise<boolean>
  onCreateWorkspace: () => Promise<boolean>
  onRenameWorkspace: (name: string) => void
  onUpdateWorkspaceSettings: (settings: Partial<WorkspaceSettings>) => void
  onExport: () => void
  onImport: () => void
  mobileMenuOpen: boolean
  onMenuOpen: () => void
}

type MenuName = 'workspaces' | 'settings' | 'help' | 'profile' | null

const statusCopy: Record<SaveStatus, string> = {
  loading: 'Открытие рабочего пространства',
  unsaved: 'Есть несохранённые изменения',
  saving: 'Сохранение…',
  saved: 'Сохранено на устройстве',
  error: 'Ошибка сохранения',
}

const defaultViewLabels: Record<WorkspaceView, string> = {
  overview: 'Обзор',
  canvas: 'Холст',
  'graph-intelligence': 'Анализ графа',
  knowledge: 'База знаний',
  developer: 'Рабочее пространство разработчика',
  projects: 'Проекты',
  tasks: 'Задачи',
  notes: 'Заметки',
  recent: 'Недавние',
  favorites: 'Избранное',
  trash: 'Корзина',
}

export default function Topbar({
  searchOpen,
  onSearchOpen,
  settingsRequest,
  saveStatus,
  workspaceId,
  workspaceName,
  workspaceSettings,
  workspaces,
  actionsDisabled,
  onSwitchWorkspace,
  onCreateWorkspace,
  onRenameWorkspace,
  onUpdateWorkspaceSettings,
  onExport,
  onImport,
  mobileMenuOpen,
  onMenuOpen,
}: TopbarProps) {
  const [openMenu, setOpenMenu] = useState<MenuName>(null)
  const [renameDraft, setRenameDraft] = useState(workspaceName)
  const topbarRef = useRef<HTMLElement>(null)
  const menuTriggerRefs = useRef<Partial<Record<Exclude<MenuName, null>, HTMLButtonElement>>>({})

  useEffect(() => {
    if (openMenu === 'settings') setRenameDraft(workspaceName)
  }, [openMenu, workspaceName])

  useEffect(() => {
    if (!openMenu) return
    const dialogId = {
      workspaces: 'workspace-switcher-dialog',
      settings: 'settings-dialog',
      help: 'help-dialog',
      profile: 'profile-dialog',
    }[openMenu]
    const dialog = topbarRef.current?.querySelector<HTMLElement>(`#${dialogId}`)
    if (!dialog) return
    const firstControl = dialog.querySelector<HTMLElement>('input:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex="0"]')
    const initialFocus = firstControl ?? dialog
    initialFocus.focus({ preventScroll: true })
  }, [openMenu])

  useEffect(() => {
    if (settingsRequest > 0) setOpenMenu('settings')
  }, [settingsRequest])

  useEffect(() => {
    if (!openMenu) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      const trigger = menuTriggerRefs.current[openMenu]
      setOpenMenu(null)
      trigger?.focus()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [openMenu])

  const toggleMenu = (menu: Exclude<MenuName, null>, trigger: HTMLButtonElement) => {
    menuTriggerRefs.current[menu] = trigger
    if (openMenu === menu) {
      setOpenMenu(null)
      trigger.focus()
      return
    }
    setOpenMenu(menu)
  }

  const closeMenu = (restoreFocus = false) => {
    if (restoreFocus && openMenu) menuTriggerRefs.current[openMenu]?.focus()
    setOpenMenu(null)
  }

  const handleRename = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const cleaned = renameDraft.trim()
    if (!cleaned || actionsDisabled) return
    onRenameWorkspace(cleaned)
    closeMenu(true)
  }

  const handleSwitch = async (id: string) => {
    if (id === workspaceId) {
      closeMenu(true)
      return
    }
    if (await onSwitchWorkspace(id)) closeMenu(true)
  }

  const handleCreateWorkspace = async () => {
    if (await onCreateWorkspace()) closeMenu(true)
  }

  const closeAnd = (action: () => void) => {
    closeMenu(true)
    action()
  }

  return (
    <header ref={topbarRef} className="topbar">
      <div className="topbar__brand">
        <button className="icon-button mobile-menu-button" aria-label={mobileMenuOpen ? 'Закрыть навигацию' : 'Открыть навигацию'} title={mobileMenuOpen ? 'Закрыть навигацию' : 'Открыть навигацию'} aria-expanded={mobileMenuOpen} aria-controls="workspace-navigation" onClick={onMenuOpen}><Menu size={19} /></button>
        <span className="brand-mark"><Workflow size={20} strokeWidth={1.9} /></span>
        <span className="brand-name">НЕЙРО <span>ХОЛСТ</span></span>
      </div>

      <div className="workspace-switcher">
        <button
          className="workspace-switcher__trigger"
          aria-label={`Переключить рабочее пространство. Сейчас открыто: ${workspaceName}`}
          aria-expanded={openMenu === 'workspaces'}
          aria-haspopup="dialog"
          aria-controls="workspace-switcher-dialog"
          ref={(element) => { if (element) menuTriggerRefs.current.workspaces = element }}
          disabled={actionsDisabled}
          onClick={(event) => toggleMenu('workspaces', event.currentTarget)}
        >
          <span className="workspace-switcher__icon"><Layers3 size={15} /></span>
          <span className="workspace-switcher__name">{workspaceName}</span>
          <ChevronDown className="workspace-switcher__chevron" size={14} />
        </button>
        {openMenu === 'workspaces' && (
          <section id="workspace-switcher-dialog" className="topbar-popover workspace-popover" role="dialog" aria-labelledby="workspace-switcher-title" tabIndex={-1}>
            <h2 id="workspace-switcher-title" className="visually-hidden">Переключение рабочего пространства</h2>
            <div className="topbar-popover__heading">
              <span className="topbar-popover__eyebrow">РАБОЧИЕ ПРОСТРАНСТВА</span>
              <strong>Выберите рабочее пространство</strong>
            </div>
            <div className="workspace-popover__list">
              {workspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  className={`workspace-option${workspace.id === workspaceId ? ' is-current' : ''}`}
                  aria-current={workspace.id === workspaceId ? 'page' : undefined}
                  onClick={() => { void handleSwitch(workspace.id) }}
                >
                  <span className="workspace-option__mark"><Workflow size={14} /></span>
                  <span className="workspace-option__name">{workspace.name}</span>
                  {workspace.id === workspaceId && <Check size={14} />}
                </button>
              ))}
            </div>
            <button className="topbar-popover__action workspace-popover__create" disabled={actionsDisabled} onClick={() => { void handleCreateWorkspace() }}>
              <Plus size={15} /> Создать рабочее пространство
            </button>
            <p className="topbar-popover__footnote">Рабочие пространства хранятся только на этом устройстве.</p>
          </section>
        )}
      </div>

      <div className={`topbar__save-status save-indicator save-indicator--${saveStatus}`} role="status" aria-live="polite" aria-busy={saveStatus === 'loading' || saveStatus === 'saving'} aria-label={`Состояние сохранения: ${statusCopy[saveStatus]}`} title={statusCopy[saveStatus]}>
        <span className="save-indicator__icon">
          {saveStatus === 'saved' ? <Check size={11} /> : saveStatus === 'error' ? <AlertCircle size={12} /> : <i />}
        </span>
        <span className="save-indicator__text">{statusCopy[saveStatus]}</span>
      </div>

      <div className="topbar__search-area">
        <button className="global-search-trigger" onClick={onSearchOpen} aria-label="Открыть поиск по рабочему пространству" title="Поиск по рабочему пространству · Ctrl/⌘ + K / Л" aria-haspopup="dialog" aria-expanded={searchOpen} aria-controls="command-palette-dialog">
          <Search size={15} />
          <span>Поиск</span>
          <span className="search-shortcut"><Command size={11} /> K / Л</span>
        </button>
      </div>

      {openMenu && <button className="topbar-menu-dismiss" aria-label="Закрыть меню" onClick={() => closeMenu(true)} />}

      <div className="topbar__actions">
        <div className="topbar-menu-wrap">
          <button
            className={`icon-button topbar-action${openMenu === 'settings' ? ' is-open' : ''}`}
            aria-label="Настройки"
            title="Настройки"
            aria-expanded={openMenu === 'settings'}
            aria-haspopup="dialog"
            aria-controls="settings-dialog"
            ref={(element) => { if (element) menuTriggerRefs.current.settings = element }}
            onClick={(event) => toggleMenu('settings', event.currentTarget)}
          ><Settings2 size={16} /></button>
          {openMenu === 'settings' && (
            <section id="settings-dialog" className="topbar-popover settings-popover" role="dialog" aria-labelledby="settings-dialog-title" tabIndex={-1}>
              <h2 id="settings-dialog-title" className="visually-hidden">Настройки рабочего пространства</h2>
              <div className="topbar-popover__heading">
                <span className="topbar-popover__eyebrow">НАСТРОЙКИ</span>
                <strong>Параметры рабочего пространства</strong>
              </div>
              <form className="settings-rename" onSubmit={handleRename}>
                <label htmlFor="workspace-name-setting">НАЗВАНИЕ РАБОЧЕГО ПРОСТРАНСТВА</label>
                <div className="settings-rename__row">
                  <input
                    id="workspace-name-setting"
                    value={renameDraft}
                    maxLength={100}
                    disabled={actionsDisabled}
                    onChange={(event) => setRenameDraft(event.target.value)}
                  />
                  <button type="submit" className="settings-rename__save" disabled={actionsDisabled || !renameDraft.trim() || renameDraft.trim() === workspaceName}>Сохранить</button>
                </div>
              </form>
              <div className="settings-default-view">
                <label htmlFor="workspace-default-view-setting">СТАРТОВЫЙ РАЗДЕЛ</label>
                <select
                  id="workspace-default-view-setting"
                  aria-label="Стартовый раздел рабочего пространства"
                  value={workspaceSettings.defaultView}
                  disabled={actionsDisabled}
                  onChange={(event) => onUpdateWorkspaceSettings({ defaultView: event.target.value as WorkspaceView })}
                >
                  {Object.entries(defaultViewLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div className="topbar-popover__divider" />
              <button className="topbar-popover__action" disabled={actionsDisabled} onClick={() => closeAnd(onImport)}><Upload size={15} /> Импортировать рабочее пространство из JSON-файла</button>
              <button className="topbar-popover__action" disabled={actionsDisabled} onClick={() => closeAnd(onExport)}><Download size={15} /> Экспортировать рабочее пространство в JSON-файл</button>
              <p className="topbar-popover__footnote">Изменения сохраняются на этом устройстве.</p>
            </section>
          )}
        </div>

        <div className="topbar-menu-wrap">
          <button
            className={`icon-button topbar-action${openMenu === 'help' ? ' is-open' : ''}`}
            aria-label="Справка"
            title="Справка и сочетания клавиш"
            aria-expanded={openMenu === 'help'}
            aria-haspopup="dialog"
            aria-controls="help-dialog"
            ref={(element) => { if (element) menuTriggerRefs.current.help = element }}
            onClick={(event) => toggleMenu('help', event.currentTarget)}
          ><CircleHelp size={16} /></button>
          {openMenu === 'help' && (
            <section id="help-dialog" className="topbar-popover help-popover" role="dialog" aria-labelledby="help-dialog-title" tabIndex={-1}>
              <h2 id="help-dialog-title" className="visually-hidden">Справка и сочетания клавиш</h2>
              <div className="topbar-popover__heading">
                <span className="topbar-popover__eyebrow">КРАТКАЯ СПРАВКА</span>
                <strong>Работайте быстрее с сочетаниями клавиш</strong>
              </div>
              <div className="shortcut-list">
                <div><span>Открыть поиск</span><kbd>⌘ / Ctrl + K / Л</kbd></div>
                <div><span>Быстро записать идею</span><kbd>N / Т</kbd></div>
                <div><span>Очистить поиск или закрыть окно</span><kbd>Esc</kbd></div>
                <div><span>Переместить выбранный объект в корзину</span><kbd>Del</kbd></div>
              </div>
              <p className="topbar-popover__footnote">Перетащите от точки одного узла к точке другого, чтобы создать связь.</p>
            </section>
          )}
        </div>

        <div className="topbar-menu-wrap topbar-menu-wrap--profile">
          <button
            className={`profile-menu-trigger${openMenu === 'profile' ? ' is-open' : ''}`}
            aria-label="Меню локального профиля"
            title="Локальный профиль"
            aria-expanded={openMenu === 'profile'}
            aria-haspopup="dialog"
            aria-controls="profile-dialog"
            ref={(element) => { if (element) menuTriggerRefs.current.profile = element }}
            onClick={(event) => toggleMenu('profile', event.currentTarget)}
          >
            <span className="profile-avatar topbar-avatar">НХ</span>
            <ChevronDown size={13} />
          </button>
          {openMenu === 'profile' && (
            <section id="profile-dialog" className="topbar-popover profile-popover" role="dialog" aria-labelledby="profile-dialog-title" tabIndex={-1}>
              <div className="profile-popover__identity">
                <span className="profile-avatar">НХ</span>
                <span><strong id="profile-dialog-title">Локальный профиль</strong><small>Личный · на этом устройстве</small></span>
              </div>
              <div className="profile-popover__privacy">
                <span className="local-status-dot" />
                <span>Данные рабочего пространства остаются в этом браузере. Аккаунт и синхронизация с облаком не нужны.</span>
              </div>
              <button className="topbar-popover__action" onClick={() => setOpenMenu('settings')}><Settings2 size={15} /> Настроить рабочее пространство</button>
              <button className="topbar-popover__action" disabled={actionsDisabled} onClick={() => closeAnd(onExport)}><Download size={15} /> Сохранить резервную копию</button>
              <div className="profile-popover__footer"><UserRound size={13} /> Локальный профиль, доступный без интернета</div>
            </section>
          )}
        </div>
      </div>
    </header>
  )
}
