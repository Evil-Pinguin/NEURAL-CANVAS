import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, X } from 'lucide-react'
import CanvasWorkspace from './components/CanvasWorkspace'
import CommandPalette from './components/CommandPalette'
import Inspector from './components/Inspector'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import WorkspaceViews from './components/WorkspaceViews'
import ImportWorkspaceDialog from './components/ImportWorkspaceDialog'
import { knowledgeNodeTypes, type NodeKind, type Workspace, type WorkspaceFilters, type WorkspaceView } from './domain/model'
import { createWorkspaceExport, parseWorkspaceImport } from './data/workspace-transfer'
import { useWorkspaceStore, type WorkspaceImportMode } from './store/workspace-store'
import { findClearPosition } from './utils/layout'
import { matchesNode } from './utils/search'
import { formatRussianCount } from './utils/locale'
import './styles.css'
import './design-system.css'

type PendingImport = {
  fileName: string
  workspace?: Workspace
  legacy?: boolean
  error?: string
}

function localizedErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message.trim() : ''
  return message && /[А-Яа-яЁё]/u.test(message) ? message : fallback
}

function readFileAsText(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('Не удалось прочитать содержимое выбранного файла.'))
    reader.onerror = () => reject(new Error('Не удалось прочитать выбранный файл.'))
    reader.readAsText(file)
  })
}

export default function App() {
  const workspace = useWorkspaceStore((state) => state.workspace)
  const isReady = useWorkspaceStore((state) => state.isReady)
  const saveStatus = useWorkspaceStore((state) => state.saveStatus)
  const workspaces = useWorkspaceStore((state) => state.workspaces)
  const storageError = useWorkspaceStore((state) => state.storageError)
  const storageWarning = useWorkspaceStore((state) => state.storageWarning)
  const selectedNodeId = useWorkspaceStore((state) => state.selectedNodeId)
  const initialize = useWorkspaceStore((state) => state.initialize)
  const clearStorageWarning = useWorkspaceStore((state) => state.clearStorageWarning)
  const setSelectedNodeId = useWorkspaceStore((state) => state.setSelectedNodeId)
  const addNode = useWorkspaceStore((state) => state.addNode)
  const importWorkspace = useWorkspaceStore((state) => state.importWorkspace)
  const switchWorkspace = useWorkspaceStore((state) => state.switchWorkspace)
  const createWorkspace = useWorkspaceStore((state) => state.createWorkspace)
  const updateWorkspaceName = useWorkspaceStore((state) => state.updateWorkspaceName)
  const updateWorkspaceSettings = useWorkspaceStore((state) => state.updateWorkspaceSettings)
  const [activeView, setActiveView] = useState<WorkspaceView>('canvas')
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [graphFitRequest, setGraphFitRequest] = useState(0)
  const [settingsRequest, setSettingsRequest] = useState(0)
  const [architectureNoteToOpen, setArchitectureNoteToOpen] = useState<string | null>(null)
  const [filters, setFilters] = useState<WorkspaceFilters>({ kind: 'all', status: 'all' })
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([])
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [inspectorCollapsed, setInspectorCollapsed] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' } | null>(null)
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null)
  const [importActionError, setImportActionError] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const appliedInitialView = useRef(false)

  useEffect(() => { void initialize() }, [initialize])
  useEffect(() => {
    if (!isReady || appliedInitialView.current) return
    appliedInitialView.current = true
    setActiveView(workspace.settings.defaultView)
  }, [isReady, workspace.settings.defaultView])
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])

  const showToast = useCallback((message: string, kind: 'success' | 'error' = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ message, kind })
    toastTimer.current = setTimeout(() => setToast(null), 3800)
  }, [])

  const selectNode = useCallback((id: string | null) => {
    setSelectedNodeIds(id ? [id] : [])
    setSelectedEdgeIds([])
    setSelectedNodeId(id)
  }, [setSelectedNodeId])

  const setPrimaryNode = useCallback((id: string | null) => setSelectedNodeId(id), [setSelectedNodeId])
  const toggleInspector = useCallback(() => setInspectorCollapsed((collapsed) => !collapsed), [])
  const openInspector = useCallback(() => setInspectorCollapsed(false), [])

  const handleSelectionChange = useCallback((nodeIds: string[], edgeIds: string[]) => {
    setSelectedNodeIds(nodeIds)
    setSelectedEdgeIds(edgeIds)
    const current = useWorkspaceStore.getState().selectedNodeId
    setSelectedNodeId(current && nodeIds.includes(current) ? current : nodeIds[0] ?? null)
  }, [setSelectedNodeId])

  const handleWorkspaceSwitch = useCallback(async (id: string) => {
    const switched = await switchWorkspace(id)
    if (switched) {
      setActiveView(useWorkspaceStore.getState().workspace.settings.defaultView)
      setQuery('')
      setSelectedNodeIds([])
      setSelectedEdgeIds([])
      setMobileSidebarOpen(false)
    } else {
      showToast('Не удалось открыть рабочее пространство. Проверьте локальное хранилище; если сохранение завершилось ошибкой, сначала экспортируйте резервную копию.', 'error')
    }
    return switched
  }, [setActiveView, showToast, switchWorkspace])

  const handleWorkspaceCreate = useCallback(async () => {
    const created = await createWorkspace()
    if (created) {
      setActiveView('canvas')
      setQuery('')
      setSelectedNodeIds([])
      setSelectedEdgeIds([])
      setMobileSidebarOpen(false)
      showToast('Новое рабочее пространство создано и сохранено на этом устройстве.')
    } else {
      showToast('Не удалось создать рабочее пространство. Проверьте локальное хранилище и повторите попытку.', 'error')
    }
    return created
  }, [createWorkspace, setActiveView, showToast])

  const createNode = useCallback((kind: NodeKind, moveToCanvas = !['knowledge', 'developer', 'notes'].includes(activeView)) => {
    const state = useWorkspaceStore.getState()
    const selectedNode = state.workspace.nodes.find((item) => item.id === state.selectedNodeId && !item.deletedAt)
    const anchor = selectedNode
      ? { x: selectedNode.position.x + 250, y: selectedNode.position.y }
      : { x: 470, y: 275 }
    const position = findClearPosition(state.workspace.nodes.filter((item) => !item.deletedAt), anchor, kind)
    const node = addNode(kind, position)
    setSelectedNodeIds([node.id])
    setSelectedEdgeIds([])
    setQuery('')
    setFilters({ kind: 'all', status: 'all' })
    if (moveToCanvas) {
      setSelectedNodeId(node.id)
      setActiveView('canvas')
      openInspector()
    }
    setMobileSidebarOpen(false)
    return node
  }, [activeView, addNode, openInspector, setActiveView, setSelectedNodeId])

  const exportWorkspace = useCallback(() => {
    try {
      const backup = createWorkspaceExport(workspace)
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const safeName = workspace.name.toLocaleLowerCase('ru-RU').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'рабочее-пространство'
      link.href = url
      link.download = `нейро-холст-${safeName}-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      showToast(`Создана резервная копия рабочего пространства «${workspace.name}».`)
    } catch (error) {
      showToast(`Не удалось экспортировать данные: ${localizedErrorMessage(error, 'Проверьте локальное хранилище и повторите попытку.')}`, 'error')
    }
  }, [workspace, showToast])

  const readImportFile = useCallback(async (file?: File) => {
    if (!file) return
    setImportActionError(null)
    try {
      const parsed: unknown = JSON.parse(await readFileAsText(file))
      const imported = parseWorkspaceImport(parsed)
      setPendingImport({ fileName: file.name, workspace: imported.workspace, legacy: imported.legacy })
    } catch (error) {
      const message = error instanceof SyntaxError ? 'Файл повреждён или не является корректным JSON.' : localizedErrorMessage(error, 'Не удалось прочитать выбранный файл.')
      setPendingImport({ fileName: file.name, error: `Не удалось проверить файл импорта: ${message}` })
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [])

  const confirmImport = useCallback(async (mode: WorkspaceImportMode) => {
    const imported = pendingImport?.workspace
    if (!imported) return
    setIsImporting(true)
    setImportActionError(null)
    try {
      const result = await importWorkspace(imported, mode)
      if (!result.success) {
        setImportActionError(result.message)
        return
      }

      setPendingImport(null)
      setSelectedNodeIds([])
      setSelectedEdgeIds([])
      setQuery('')
      setFilters({ kind: 'all', status: 'all' })
      setActiveView(useWorkspaceStore.getState().workspace.settings.defaultView)
      if (result.mode === 'replace') {
        showToast(`Рабочее пространство заменено. Автоматическая резервная копия сохранена под именем «${result.backupName}».`)
      } else {
        const stats = result.stats
        const summary = stats
          ? `Добавлено: узлов — ${stats.addedNodes}, связей — ${stats.addedEdges}, архитектурных заметок — ${stats.addedArchitectureNotes}.`
          : 'Рабочие пространства объединены.'
        const notes = stats?.skippedCyclicEdges
          ? ` ${formatRussianCount(stats.skippedCyclicEdges, { one: 'связь пропущена, чтобы не нарушать целостность графа', few: 'связи пропущены, чтобы не нарушать целостность графа', many: 'связей пропущено, чтобы не нарушать целостность графа' })}.`
          : stats?.skippedDuplicateRecords
            ? ` ${formatRussianCount(stats.skippedDuplicateRecords, { one: 'совпадающая запись уже была в рабочем пространстве', few: 'совпадающие записи уже были в рабочем пространстве', many: 'совпадающих записей уже было в рабочем пространстве' })}.`
            : ''
        showToast(`${summary}${notes}`)
      }
    } catch (error) {
      setImportActionError(localizedErrorMessage(error, 'Не удалось завершить импорт. Существующие данные не заменены. Проверьте доступ к хранилищу браузера и повторите попытку.'))
    } finally {
      setIsImporting(false)
    }
  }, [importWorkspace, pendingImport, setActiveView, showToast])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      const isTyping = target instanceof HTMLElement && (
        target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      )
      const insideDialogOrMenu = target instanceof Element && Boolean(target.closest('[role="dialog"], [role="menu"]'))
      if (insideDialogOrMenu || document.querySelector('[aria-modal="true"]')) return
      if ((event.metaKey || event.ctrlKey) && (event.key.toLowerCase() === 'k' || event.code === 'KeyK')) {
        event.preventDefault()
        setSearchOpen(true)
        return
      }
      if (event.key === 'Escape') {
        if (searchOpen) setSearchOpen(false)
        else if (query) setQuery('')
        setMobileSidebarOpen(false)
        return
      }
      if (!isTyping && !event.metaKey && !event.ctrlKey && !event.altKey && (event.key.toLowerCase() === 'n' || event.code === 'KeyN') && useWorkspaceStore.getState().isReady) {
        event.preventDefault()
        createNode('idea', true)
        return
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [createNode, query, searchOpen])

  const openNodeOnCanvas = (id: string) => {
    const target = workspace.nodes.find((node) => node.id === id && !node.deletedAt)
    if (target && !matchesNode(target, query, filters)) {
      setQuery('')
      setFilters({ kind: 'all', status: 'all' })
    }
    selectNode(id)
    setActiveView('canvas')
    openInspector()
    setSearchOpen(false)
  }

  const focusGraphSelection = useCallback((nodeIds: string[], edgeIds: string[]) => {
    const activeNodeIds = new Set(workspace.nodes.filter((node) => !node.deletedAt).map((node) => node.id))
    const activeEdgeIds = new Set(workspace.edges
      .filter((edge) => activeNodeIds.has(edge.sourceId) && activeNodeIds.has(edge.targetId))
      .map((edge) => edge.id))
    const nextNodeIds = [...new Set(nodeIds)].filter((id) => activeNodeIds.has(id))
    if (nextNodeIds.length === 0) return

    setQuery('')
    setFilters({ kind: 'all', status: 'all' })
    setSelectedNodeIds(nextNodeIds)
    setSelectedEdgeIds([...new Set(edgeIds)].filter((id) => activeEdgeIds.has(id)))
    setSelectedNodeId(nextNodeIds[0] ?? null)
    setActiveView('canvas')
    setSearchOpen(false)
  }, [setSelectedNodeId, workspace.edges, workspace.nodes])

  const openArchitectureNote = (id: string) => {
    setArchitectureNoteToOpen(id)
    setActiveView('developer')
    setSearchOpen(false)
  }

  const executePaletteCommand = (id: string, searchQuery: string) => {
    setSearchOpen(false)
    if (id !== 'search-graph') setQuery('')
    if (id === 'create-idea') {
      createNode('idea', true)
      return
    }
    if (id === 'create-project') {
      createNode('project', false)
      setActiveView('developer')
      return
    }
    if (id === 'create-task') {
      const task = createNode('task', false)
      const project = useWorkspaceStore.getState().workspace.nodes.find((node) => node.type === 'project' && !node.deletedAt)
      useWorkspaceStore.getState().updateNode(task.id, { projectId: project?.id ?? null, taskStatus: 'backlog', dueDate: null })
      setActiveView('developer')
      return
    }
    if (id === 'create-note') {
      createNode('note', false)
      setActiveView('notes')
      return
    }
    if (id === 'search-graph') {
      setQuery(searchQuery)
      setFilters({ kind: 'all', status: 'all' })
      setActiveView('canvas')
      return
    }
    if (id === 'fit-graph') {
      setFilters({ kind: 'all', status: 'all' })
      setActiveView('canvas')
      setGraphFitRequest((request) => request + 1)
      return
    }
    if (id === 'export-workspace') {
      exportWorkspace()
      return
    }
    if (id === 'open-settings') setSettingsRequest((request) => request + 1)
  }

  const liveNodes = workspace.nodes.filter((node) => !node.deletedAt)
  const taskCount = liveNodes.filter((node) => node.type === 'task' && node.status !== 'done' && node.status !== 'archived').length
  const favoriteCount = liveNodes.filter((node) => node.favorite).length
  const trashCount = workspace.nodes.length - liveNodes.length
  const notesCount = liveNodes.filter((node) => node.type === 'note').length
  const sidebarResultCount = workspace.nodes.filter((node) => {
    const inTrash = activeView === 'trash'
    if (Boolean(node.deletedAt) !== inTrash) return false
    if (activeView === 'favorites' && !node.favorite) return false
    if (activeView === 'notes' && node.type !== 'note') return false
    if (activeView === 'projects' && node.type !== 'project') return false
    if (activeView === 'tasks' && node.type !== 'task') return false
    if (activeView === 'knowledge' && !knowledgeNodeTypes.includes(node.type)) return false
    return matchesNode(node, query, filters)
  }).length

  return (
    <div className="app-shell">
      <Topbar
        searchOpen={searchOpen}
        onSearchOpen={() => setSearchOpen(true)}
        settingsRequest={settingsRequest}
        saveStatus={saveStatus}
        workspaceId={workspace.id}
        workspaceName={workspace.name}
        workspaceSettings={workspace.settings}
        workspaces={workspaces}
        actionsDisabled={!isReady}
        onSwitchWorkspace={handleWorkspaceSwitch}
        onCreateWorkspace={handleWorkspaceCreate}
        onRenameWorkspace={updateWorkspaceName}
        onUpdateWorkspaceSettings={updateWorkspaceSettings}
        onExport={exportWorkspace}
        onImport={() => fileInputRef.current?.click()}
        mobileMenuOpen={mobileSidebarOpen}
        onMenuOpen={() => setMobileSidebarOpen((open) => !open)}
      />
      <input
        ref={fileInputRef}
        className="visually-hidden-input"
        type="file"
        accept="application/json,.json"
        aria-label="Выберите файл рабочего пространства"
        onChange={(event) => { void readImportFile(event.target.files?.[0]) }}
      />
      {storageWarning && <div className="storage-warning" role="alert"><AlertCircle size={15} /><span>{storageWarning}</span><button className="icon-button" aria-label="Закрыть предупреждение о хранилище" onClick={clearStorageWarning}><X size={13} /></button></div>}
      <div className={`workspace-shell${isReady ? '' : ' is-loading'}`} aria-busy={!isReady}>
        <Sidebar
          activeView={activeView}
          onChangeView={setActiveView}
          onCreateNode={() => createNode('idea', true)}
          workspaceName={workspace.name}
          query={query}
          onQueryChange={setQuery}
          filters={filters}
          onFiltersChange={setFilters}
          onClearFilters={() => { setQuery(''); setFilters({ kind: 'all', status: 'all' }) }}
          resultCount={sidebarResultCount}
          collapsed={sidebarCollapsed && !mobileSidebarOpen}
          onToggleCollapsed={() => setSidebarCollapsed((collapsed) => !collapsed)}
          isOpen={mobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
          taskCount={taskCount}
          notesCount={notesCount}
          favoriteCount={favoriteCount}
          trashCount={trashCount}
        />
        <main className={`content-area content-area--${activeView}`}>
          {activeView === 'canvas' ? (
            <CanvasWorkspace
              workspace={workspace}
              query={query}
              filters={filters}
              selectedNodeIds={selectedNodeIds}
              selectedEdgeIds={selectedEdgeIds}
              fitRequest={graphFitRequest}
              inspectorCollapsed={inspectorCollapsed}
              onToggleInspector={toggleInspector}
              onOpenInspector={openInspector}
              onSelectionChange={handleSelectionChange}
              onPrimaryNodeChange={setPrimaryNode}
              onResetFilters={() => { setQuery(''); setFilters({ kind: 'all', status: 'all' }) }}
            />
          ) : (
            <WorkspaceViews
              view={activeView}
              workspace={workspace}
              query={query}
              filters={filters}
              onCreate={(kind) => createNode(kind)}
              onOpenNode={openNodeOnCanvas}
              onFocusGraphSelection={focusGraphSelection}
              onQueryChange={setQuery}
              selectedNodeId={selectedNodeId}
              architectureNoteToOpen={architectureNoteToOpen}
              onArchitectureNoteOpenHandled={() => setArchitectureNoteToOpen(null)}
            />
          )}
        </main>
        {activeView === 'canvas' && (
          <Inspector
            workspace={workspace}
            selectedNodeId={selectedNodeId}
            collapsed={inspectorCollapsed}
            onToggleCollapsed={toggleInspector}
            onSelectNode={selectNode}
            onCreateNode={() => createNode('idea', true)}
          />
        )}
        {!isReady && storageError ? (
          <div className="storage-recovery" role="alert">
            <section>
              <span className="storage-recovery__icon"><AlertCircle size={20} /></span>
              <h2>Нужно проверить локальное рабочее пространство</h2>
              <p>{storageError}</p>
              <button onClick={() => { void initialize() }}>Повторить открытие сохранённых данных</button>
            </section>
          </div>
        ) : !isReady ? (
          <div className="workspace-hydrating" role="status" aria-live="polite" aria-atomic="true"><span aria-hidden="true" /><span>{saveStatus === 'saving' ? 'Сохранение рабочего пространства…' : 'Открытие рабочего пространства…'}</span></div>
        ) : null}
      </div>
      {searchOpen && <CommandPalette workspace={workspace} query={query} onQueryChange={setQuery} onClose={() => setSearchOpen(false)} onOpenNode={openNodeOnCanvas} onOpenArchitectureNote={openArchitectureNote} onCommand={executePaletteCommand} />}
      {pendingImport && <ImportWorkspaceDialog
        fileName={pendingImport.fileName}
        currentWorkspaceName={workspace.name}
        workspace={pendingImport.workspace}
        legacy={pendingImport.legacy}
        error={pendingImport.error}
        actionError={importActionError}
        isWorking={isImporting}
        onCancel={() => { if (!isImporting) { setPendingImport(null); setImportActionError(null) } }}
        onConfirm={(mode) => { void confirmImport(mode) }}
      />}
      {toast && <div className={`toast toast--${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'} aria-live={toast.kind === 'error' ? 'assertive' : 'polite'} aria-atomic="true"><span aria-hidden="true">{toast.kind === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}</span><p>{toast.message}</p><button className="icon-button" aria-label="Закрыть уведомление" title="Закрыть уведомление" onClick={() => setToast(null)}><X size={14} /></button></div>}
    </div>
  )
}
