import { create } from 'zustand'
import { readWorkspace, readWorkspaces, replaceWorkspaceWithBackup, writeWorkspace } from '../data/database'
import { createInitialWorkspace, localizeLegacyStarterWorkspace } from '../domain/seed'
import { mergeWorkspaces, type WorkspaceMergeStats } from '../data/workspace-transfer'
import { defaultNodeColor, defaultRelationLabels, newArchitectureNoteTitleLabels, newNodeTitleLabels, architectureNoteSchema, toDeveloperTaskStatus, toNodeProjectStatus, toNodeStatus, toProjectStatus, wouldCreateRelationCycle, workspaceSchema, type ArchitectureNote, type ArchitectureNoteType, type CanvasEdgeData, type CanvasNodeData, type NodeKind, type RelationMetadata, type RelationType, type Workspace, type WorkspaceSettings } from '../domain/model'
import { formatRussianCount } from '../utils/locale'

export type SaveStatus = 'loading' | 'unsaved' | 'saving' | 'saved' | 'error'
export type WorkspaceSummary = Pick<Workspace, 'id' | 'name' | 'updatedAt'>
export type WorkspaceImportMode = 'replace' | 'merge'
export type WorkspaceImportResult =
  | { success: true; mode: WorkspaceImportMode; backupName?: string; stats?: WorkspaceMergeStats }
  | { success: false; message: string }

type FlowNodeSnapshot = { id: string; position: { x: number; y: number } }

type WorkspaceStore = {
  workspace: Workspace
  workspaces: WorkspaceSummary[]
  isReady: boolean
  saveStatus: SaveStatus
  storageError: string | null
  storageWarning: string | null
  selectedNodeId: string | null
  initialize: () => Promise<void>
  clearStorageWarning: () => void
  setSelectedNodeId: (id: string | null) => void
  addNode: (kind: NodeKind, position: { x: number; y: number }, connectFrom?: string | null) => CanvasNodeData
  duplicateNode: (id: string, position: { x: number; y: number }) => CanvasNodeData | null
  updateNode: (id: string, updates: Partial<Omit<CanvasNodeData, 'id'>>) => void
  deleteNode: (id: string) => void
  trashNode: (id: string) => void
  restoreNode: (id: string) => void
  toggleFavorite: (id: string) => void
  addEdge: (sourceId: string, targetId: string, relationType?: RelationType, label?: string, metadata?: RelationMetadata) => void
  updateEdgeLabel: (id: string, label: string) => void
  deleteEdge: (id: string) => void
  addArchitectureNote: (type: ArchitectureNoteType, projectId?: string | null) => ArchitectureNote | null
  updateArchitectureNote: (id: string, updates: Partial<Omit<ArchitectureNote, 'id' | 'createdAt' | 'updatedAt'>>) => void
  deleteArchitectureNote: (id: string) => void
  syncFlowNodes: (changedPositions: FlowNodeSnapshot[], removedIds: string[]) => void
  syncFlowEdges: (removedIds: string[]) => void
  importWorkspace: (workspace: Workspace, mode: WorkspaceImportMode) => Promise<WorkspaceImportResult>
  updateWorkspaceName: (name: string) => void
  updateWorkspaceSettings: (settings: Partial<WorkspaceSettings>) => void
  switchWorkspace: (id: string) => Promise<boolean>
  createWorkspace: (name?: string) => Promise<boolean>
}

type StoreSetter = (partial: Partial<WorkspaceStore> | ((state: WorkspaceStore) => Partial<WorkspaceStore>)) => void
type SaveJob = { workspace: Workspace; set: StoreSetter; generation: number }

const ACTIVE_WORKSPACE_KEY = 'neural-canvas.active-workspace'
let saveTimer: ReturnType<typeof setTimeout> | undefined
let scheduledSave: SaveJob | undefined
let pendingWrite: Promise<void> = Promise.resolve()
let saveGeneration = 0
let lastWriteSucceeded = true

function activeWorkspaceId() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(ACTIVE_WORKSPACE_KEY)
  } catch {
    return null
  }
}

function rememberActiveWorkspace(id: string) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(ACTIVE_WORKSPACE_KEY, id)
  } catch {
    // IndexedDB remains the source of truth when browser storage is restricted.
  }
}

function toSummary(workspace: Workspace): WorkspaceSummary {
  return { id: workspace.id, name: workspace.name, updatedAt: workspace.updatedAt }
}

function upsertSummary(workspaces: WorkspaceSummary[], workspace: Workspace): WorkspaceSummary[] {
  return [toSummary(workspace), ...workspaces.filter((item) => item.id !== workspace.id)]
    .sort((first, second) => first.name.localeCompare(second.name))
}

function enqueueSave(job: SaveJob) {
  const operation = pendingWrite.catch(() => undefined).then(async () => {
    if (job.generation === saveGeneration) job.set({ saveStatus: 'saving' })
    try {
      await writeWorkspace(job.workspace)
      lastWriteSucceeded = true
      if (job.generation === saveGeneration) job.set({ saveStatus: 'saved' })
    } catch {
      lastWriteSucceeded = false
      if (job.generation === saveGeneration) job.set({ saveStatus: 'error' })
    }
  })
  pendingWrite = operation
  return operation
}

function scheduleSave(workspace: Workspace, set: StoreSetter) {
  const job = { workspace, set, generation: ++saveGeneration }
  if (saveTimer) clearTimeout(saveTimer)
  scheduledSave = job
  saveTimer = setTimeout(() => {
    saveTimer = undefined
    const due = scheduledSave
    scheduledSave = undefined
    if (due) void enqueueSave(due)
  }, 350)
}

async function flushPendingSave(): Promise<boolean> {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = undefined
  }
  const due = scheduledSave
  scheduledSave = undefined
  if (due) await enqueueSave(due)
  else await pendingWrite
  return lastWriteSucceeded
}

let lifecycleFlushInstalled = false
function installLifecycleFlush() {
  if (lifecycleFlushInstalled || typeof window === 'undefined') return
  lifecycleFlushInstalled = true
  const flush = () => { void flushPendingSave() }
  const flushWhenHidden = () => {
    if (document.visibilityState === 'hidden') flush()
  }
  window.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', flushWhenHidden)
}

function makeId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function withUpdatedAt(workspace: Workspace, changes: Partial<Workspace>): Workspace {
  return { ...workspace, ...changes, updatedAt: new Date().toISOString() }
}

function getLocalizedFailureMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message.trim() : ''
  return message && /[А-Яа-яЁё]/u.test(message) ? message : fallback
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  workspace: createInitialWorkspace(),
  workspaces: [],
  isReady: false,
  saveStatus: 'loading',
  storageError: null,
  storageWarning: null,
  selectedNodeId: null,

  initialize: async () => {
    if (get().isReady) return
    installLifecycleFlush()
    set({ saveStatus: 'loading', storageError: null, storageWarning: null })
    try {
      const stored = await readWorkspaces()
      const validWorkspaces: Workspace[] = []
      let invalidCount = 0
      let localizationWarning: string | null = null
      for (const item of stored) {
        const parsed = workspaceSchema.safeParse(item)
        if (parsed.success) {
          const localized = localizeLegacyStarterWorkspace(parsed.data)
          validWorkspaces.push(localized.workspace)
          if (localized.changed) {
            try {
              await writeWorkspace(localized.workspace)
            } catch {
              localizationWarning = 'Не удалось сохранить перевод стартового примера. Ваши данные не затронуты.'
            }
          }
        } else invalidCount += 1
      }

      if (stored.length > 0 && validWorkspaces.length === 0) {
        lastWriteSucceeded = false
        set({
          isReady: false,
          saveStatus: 'error',
          storageError: 'Найдены сохранённые данные, но их не удалось проверить. Записи не изменены и не перезаписаны. Повторите попытку открыть базу данных и не очищайте данные браузера для этого сайта.'
        })
        return
      }

      const preferredId = activeWorkspaceId()
      const workspace = validWorkspaces.find((item) => item.id === preferredId)
        ?? validWorkspaces.find((item) => item.id === 'workspace-main')
        ?? [...validWorkspaces].sort((first, second) => second.updatedAt.localeCompare(first.updatedAt))[0]

      if (workspace) {
        lastWriteSucceeded = true
        rememberActiveWorkspace(workspace.id)
        set({
          workspace,
          workspaces: validWorkspaces.map(toSummary).sort((first, second) => first.name.localeCompare(second.name)),
          isReady: true,
          saveStatus: 'saved',
          storageWarning: [
            invalidCount > 0 ? `${formatRussianCount(invalidCount, { one: 'сохранённую копию не удалось проверить', few: 'сохранённые копии не удалось проверить', many: 'сохранённых копий не удалось проверить' })}. Записи оставлены без изменений; не очищайте данные браузера для этого сайта.` : null,
            localizationWarning,
          ].filter(Boolean).join(' ') || null,
        })
        return
      }

      // An empty database is the only condition that should create the starter workspace.
      const initialWorkspace = createInitialWorkspace()
      set({ saveStatus: 'saving' })
      await writeWorkspace(initialWorkspace)
      lastWriteSucceeded = true
      rememberActiveWorkspace(initialWorkspace.id)
      set({ workspace: initialWorkspace, workspaces: [toSummary(initialWorkspace)], isReady: true, saveStatus: 'saved' })
    } catch {
      lastWriteSucceeded = false
      set({
        isReady: false,
        saveStatus: 'error',
        storageError: 'Не удалось открыть локальную базу данных. Сохранённые данные не изменены. Проверьте доступ к хранилищу браузера и повторите попытку.',
      })
    }
  },

  clearStorageWarning: () => set({ storageWarning: null }),
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  addNode: (kind, position, connectFrom = null) => {
    const now = new Date().toISOString()
    const node: CanvasNodeData = {
      id: makeId(),
      type: kind,
      title: newNodeTitleLabels[kind],
      description: '',
      tags: [],
      color: defaultNodeColor[kind],
      favorite: false,
      properties: [],
      position,
      status: kind === 'task' || kind === 'project' ? 'planned' : 'active',
      priority: 'medium',
      ...(kind === 'project' ? { projectStatus: 'idea' as const, techStack: [], repositoryUrl: '', demoUrl: '' } : {}),
      ...(kind === 'task' ? { taskStatus: 'backlog' as const, dueDate: null, projectId: null } : {}),
      ...(kind === 'note' ? { markdownContent: '' } : {}),
      createdAt: now,
      updatedAt: now,
    }
    set((state) => {
      const connectableSource = connectFrom && state.workspace.nodes.some((item) => item.id === connectFrom && !item.deletedAt)
      const edges = connectableSource && state.workspace.edges.length < 5000
        ? [...state.workspace.edges, {
          id: makeId(),
          sourceId: connectFrom,
          targetId: node.id,
          relationType: 'related_to' as const,
          label: defaultRelationLabels.related_to,
          createdAt: now,
        }]
        : state.workspace.edges
      const workspace = withUpdatedAt(state.workspace, { nodes: [...state.workspace.nodes, node], edges })
      scheduleSave(workspace, set)
      return {
        workspace,
        workspaces: upsertSummary(state.workspaces, workspace),
        selectedNodeId: node.id,
        saveStatus: 'unsaved',
      }
    })
    return node
  },

  duplicateNode: (id, position) => {
    const source = get().workspace.nodes.find((item) => item.id === id)
    if (!source || source.deletedAt || get().workspace.nodes.length >= 2000) return null
    const now = new Date().toISOString()
    const suffix = ' (копия)'
    const duplicate: CanvasNodeData = {
      ...source,
      id: makeId(),
      title: `${source.title.slice(0, 180 - suffix.length).trimEnd()}${suffix}`,
      position: { ...position },
      tags: [...source.tags],
      properties: source.properties.map((property) => ({ ...property, id: makeId() })),
      favorite: false,
      createdAt: now,
      updatedAt: now,
    }
    set((state) => {
      const workspace = withUpdatedAt(state.workspace, { nodes: [...state.workspace.nodes, duplicate] })
      scheduleSave(workspace, set)
      return {
        workspace,
        workspaces: upsertSummary(state.workspaces, workspace),
        selectedNodeId: duplicate.id,
        saveStatus: 'unsaved',
      }
    })
    return duplicate
  },

  updateNode: (id, updates) => set((state) => {
    const previous = state.workspace.nodes.find((node) => node.id === id)
    if (!previous) return {}
    const nodeUpdates: Partial<Omit<CanvasNodeData, 'id'>> = { ...updates }
    const now = updates.updatedAt ?? new Date().toISOString()
    const changesType = updates.type !== undefined && updates.type !== previous.type
    const projectStopsBeingProject = previous.type === 'project' && changesType && updates.type !== 'project'

    if (previous.type === 'task' && !changesType) {
      if (updates.taskStatus !== undefined) nodeUpdates.status = toNodeStatus(updates.taskStatus)
      else if (updates.status !== undefined) nodeUpdates.taskStatus = toDeveloperTaskStatus(updates.status)
      if (updates.projectId && !state.workspace.nodes.some((node) => node.id === updates.projectId && node.type === 'project')) return {}
    }
    if (previous.type === 'project' && !changesType) {
      if (updates.projectStatus !== undefined) nodeUpdates.status = toNodeProjectStatus(updates.projectStatus)
      else if (updates.status !== undefined) nodeUpdates.projectStatus = toProjectStatus(updates.status)
    }
    if (changesType) {
      if (previous.type === 'task') {
        delete nodeUpdates.taskStatus
        delete nodeUpdates.dueDate
        delete nodeUpdates.projectId
      }
      if (previous.type === 'project') {
        delete nodeUpdates.projectStatus
        delete nodeUpdates.techStack
        delete nodeUpdates.repositoryUrl
        delete nodeUpdates.demoUrl
      }
      if (updates.type === 'task') {
        nodeUpdates.taskStatus = toDeveloperTaskStatus(updates.status ?? previous.status)
        nodeUpdates.dueDate = null
        nodeUpdates.projectId = null
      }
      if (updates.type === 'project') {
        nodeUpdates.projectStatus = toProjectStatus(updates.status ?? previous.status)
        nodeUpdates.techStack = []
        nodeUpdates.repositoryUrl = ''
        nodeUpdates.demoUrl = ''
      }
    }

    const nodes = state.workspace.nodes.map((node) => {
      if (node.id === id) return { ...node, ...nodeUpdates, updatedAt: now }
      if (projectStopsBeingProject && node.type === 'task' && node.projectId === id) {
        return { ...node, projectId: null, updatedAt: now }
      }
      return node
    })
    const architectureNotes = projectStopsBeingProject
      ? state.workspace.architectureNotes.map((note) => note.projectId === id ? { ...note, projectId: null, updatedAt: now } : note)
      : state.workspace.architectureNotes
    const workspace = withUpdatedAt(state.workspace, { nodes, architectureNotes })
    if (!workspaceSchema.safeParse(workspace).success) return {}
    scheduleSave(workspace, set)
    return { workspace, workspaces: upsertSummary(state.workspaces, workspace), saveStatus: 'unsaved' }
  }),

  deleteNode: (id) => set((state) => {
    if (!state.workspace.nodes.some((node) => node.id === id)) return {}
    const now = new Date().toISOString()
    const architectureNotes = state.workspace.architectureNotes.map((note) => {
      const relatedNodeIds = note.relatedNodeIds.filter((nodeId) => nodeId !== id)
      if (note.projectId !== id && relatedNodeIds.length === note.relatedNodeIds.length) return note
      return { ...note, projectId: note.projectId === id ? null : note.projectId, relatedNodeIds, updatedAt: now }
    })
    const nodes = state.workspace.nodes
      .filter((node) => node.id !== id)
      .map((node) => node.type === 'task' && node.projectId === id ? { ...node, projectId: null, updatedAt: now } : node)
    const workspace = withUpdatedAt(state.workspace, {
      nodes,
      edges: state.workspace.edges.filter((edge) => edge.sourceId !== id && edge.targetId !== id),
      architectureNotes,
    })
    scheduleSave(workspace, set)
    return {
      workspace,
      workspaces: upsertSummary(state.workspaces, workspace),
      selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
      saveStatus: 'unsaved',
    }
  }),

  trashNode: (id) => set((state) => {
    const node = state.workspace.nodes.find((item) => item.id === id)
    if (!node || node.deletedAt) return {}
    const deletedAt = new Date().toISOString()
    const nodes = state.workspace.nodes.map((item) => item.id === id ? { ...item, deletedAt, updatedAt: deletedAt } : item)
    const workspace = withUpdatedAt(state.workspace, { nodes })
    scheduleSave(workspace, set)
    return {
      workspace,
      workspaces: upsertSummary(state.workspaces, workspace),
      selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
      saveStatus: 'unsaved',
    }
  }),

  restoreNode: (id) => set((state) => {
    const node = state.workspace.nodes.find((item) => item.id === id)
    if (!node?.deletedAt) return {}
    const updatedAt = new Date().toISOString()
    const nodes = state.workspace.nodes.map((item) => {
      if (item.id !== id) return item
      const restored = { ...item, updatedAt }
      delete restored.deletedAt
      return restored
    })
    const workspace = withUpdatedAt(state.workspace, { nodes })
    scheduleSave(workspace, set)
    return { workspace, workspaces: upsertSummary(state.workspaces, workspace), saveStatus: 'unsaved' }
  }),

  toggleFavorite: (id) => set((state) => {
    const node = state.workspace.nodes.find((item) => item.id === id)
    if (!node || node.deletedAt) return {}
    const nodes = state.workspace.nodes.map((item) => item.id === id
      ? { ...item, favorite: !item.favorite, updatedAt: new Date().toISOString() }
      : item)
    const workspace = withUpdatedAt(state.workspace, { nodes })
    scheduleSave(workspace, set)
    return { workspace, workspaces: upsertSummary(state.workspaces, workspace), saveStatus: 'unsaved' }
  }),

  addEdge: (sourceId, targetId, relationType = 'related_to', label, metadata) => set((state) => {
    if (!sourceId || !targetId || sourceId === targetId || state.workspace.edges.length >= 5000) return {}
    const sourceNode = state.workspace.nodes.find((node) => node.id === sourceId && !node.deletedAt)
    const targetNode = state.workspace.nodes.find((node) => node.id === targetId && !node.deletedAt)
    if (!sourceNode || !targetNode) return {}
    const exists = state.workspace.edges.some((edge) => edge.sourceId === sourceId && edge.targetId === targetId && edge.relationType === relationType)
    if (exists || wouldCreateRelationCycle(state.workspace.edges, sourceId, targetId, relationType)) return {}
    const edge: CanvasEdgeData = {
      id: makeId(),
      sourceId,
      targetId,
      relationType,
      label: label?.trim() || defaultRelationLabels[relationType],
      createdAt: new Date().toISOString(),
      ...(metadata ? { metadata } : {}),
    }
    const workspace = withUpdatedAt(state.workspace, { edges: [...state.workspace.edges, edge] })
    scheduleSave(workspace, set)
    return { workspace, workspaces: upsertSummary(state.workspaces, workspace), saveStatus: 'unsaved' }
  }),

  updateEdgeLabel: (id, label) => set((state) => {
    const edge = state.workspace.edges.find((item) => item.id === id)
    const normalizedLabel = label.trim()
    if (!edge || !normalizedLabel || normalizedLabel.length > 80 || edge.label === normalizedLabel) return {}
    const edges = state.workspace.edges.map((item) => item.id === id ? { ...item, label: normalizedLabel } : item)
    const workspace = withUpdatedAt(state.workspace, { edges })
    scheduleSave(workspace, set)
    return { workspace, workspaces: upsertSummary(state.workspaces, workspace), saveStatus: 'unsaved' }
  }),

  deleteEdge: (id) => set((state) => {
    if (!state.workspace.edges.some((edge) => edge.id === id)) return {}
    const workspace = withUpdatedAt(state.workspace, { edges: state.workspace.edges.filter((edge) => edge.id !== id) })
    scheduleSave(workspace, set)
    return { workspace, workspaces: upsertSummary(state.workspaces, workspace), saveStatus: 'unsaved' }
  }),

  addArchitectureNote: (type, projectId = null) => {
    const current = get().workspace
    if (current.architectureNotes.length >= 1000) return null
    if (projectId && !current.nodes.some((node) => node.id === projectId && node.type === 'project' && !node.deletedAt)) return null
    const now = new Date().toISOString()
    const note: ArchitectureNote = {
      id: makeId(),
      title: newArchitectureNoteTitleLabels[type],
      type,
      projectId,
      content: '',
      url: '',
      code: '',
      codeLanguage: 'text',
      tags: [],
      relatedNodeIds: [],
      createdAt: now,
      updatedAt: now,
    }
    set((state) => {
      const workspace = withUpdatedAt(state.workspace, { architectureNotes: [...state.workspace.architectureNotes, note] })
      scheduleSave(workspace, set)
      return { workspace, workspaces: upsertSummary(state.workspaces, workspace), saveStatus: 'unsaved' }
    })
    return note
  },

  updateArchitectureNote: (id, updates) => set((state) => {
    const previous = state.workspace.architectureNotes.find((note) => note.id === id)
    if (!previous) return {}
    const candidate = architectureNoteSchema.safeParse({ ...previous, ...updates, updatedAt: new Date().toISOString() })
    if (!candidate.success) return {}
    const note = candidate.data
    if (note.projectId && !state.workspace.nodes.some((node) => node.id === note.projectId && node.type === 'project')) return {}
    if (!note.relatedNodeIds.every((nodeId) => state.workspace.nodes.some((node) => node.id === nodeId))) return {}
    const architectureNotes = state.workspace.architectureNotes.map((item) => item.id === id ? note : item)
    const workspace = withUpdatedAt(state.workspace, { architectureNotes })
    if (!workspaceSchema.safeParse(workspace).success) return {}
    scheduleSave(workspace, set)
    return { workspace, workspaces: upsertSummary(state.workspaces, workspace), saveStatus: 'unsaved' }
  }),

  deleteArchitectureNote: (id) => set((state) => {
    const architectureNotes = state.workspace.architectureNotes.filter((note) => note.id !== id)
    if (architectureNotes.length === state.workspace.architectureNotes.length) return {}
    const workspace = withUpdatedAt(state.workspace, { architectureNotes })
    scheduleSave(workspace, set)
    return { workspace, workspaces: upsertSummary(state.workspaces, workspace), saveStatus: 'unsaved' }
  }),

  syncFlowNodes: (changedPositions, removedIds) => set((state) => {
    const positions = new Map(changedPositions.map((node) => [node.id, node.position]))
    const removed = new Set(removedIds)
    const changedAt = new Date().toISOString()
    const nodes = state.workspace.nodes.map((node) => {
      if (removed.has(node.id) && !node.deletedAt) return { ...node, deletedAt: changedAt, updatedAt: changedAt }
      const position = positions.get(node.id)
      if (position && (position.x !== node.position.x || position.y !== node.position.y)) {
        return { ...node, position, updatedAt: changedAt }
      }
      return node
    })
    const changed = nodes.some((node, index) => {
      const previous = state.workspace.nodes[index]
      return node.deletedAt !== previous?.deletedAt
        || node.position.x !== previous?.position.x
        || node.position.y !== previous?.position.y
        || node.updatedAt !== previous?.updatedAt
    })
    if (!changed) return {}
    const workspace = withUpdatedAt(state.workspace, { nodes })
    scheduleSave(workspace, set)
    return {
      workspace,
      workspaces: upsertSummary(state.workspaces, workspace),
      saveStatus: 'unsaved',
      ...(state.selectedNodeId && removed.has(state.selectedNodeId) ? { selectedNodeId: null } : {}),
    }
  }),

  syncFlowEdges: (removedIds) => set((state) => {
    if (removedIds.length === 0) return {}
    const removed = new Set(removedIds)
    const edges = state.workspace.edges.filter((edge) => !removed.has(edge.id))
    if (edges.length === state.workspace.edges.length) return {}
    const workspace = withUpdatedAt(state.workspace, { edges })
    scheduleSave(workspace, set)
    return { workspace, workspaces: upsertSummary(state.workspaces, workspace), saveStatus: 'unsaved' }
  }),

  importWorkspace: async (incoming, mode) => {
    const beforeFlush = get()
    if (!beforeFlush.isReady) return { success: false, message: 'Рабочее пространство ещё не готово к импорту.' }

    set({ isReady: false, saveStatus: 'saving' })
    if (!(await flushPendingSave())) {
      set({ isReady: true, saveStatus: 'error' })
      return { success: false, message: 'Не удалось сначала сохранить рабочее пространство. Импорт не выполнен. Устраните ошибку сохранения и повторите попытку.' }
    }

    const current = get().workspace
    let writeAttempted = false
    try {
      if (mode === 'merge') {
        const { workspace, stats } = mergeWorkspaces(current, incoming)
        writeAttempted = true
        await writeWorkspace(workspace)
        lastWriteSucceeded = true
        set((state) => ({
          workspace,
          workspaces: upsertSummary(state.workspaces, workspace),
          selectedNodeId: null,
          isReady: true,
          saveStatus: 'saved',
          storageError: null,
        }))
        return { success: true, mode, stats }
      }

      const now = new Date().toISOString()
      const dateSuffix = now.slice(0, 16).replace('T', ' ')
      const backupSuffix = ` (резервная копия ${dateSuffix})`
      const backupName = `${current.name.slice(0, Math.max(1, 100 - backupSuffix.length))}${backupSuffix}`
      const backup: Workspace = {
        ...current,
        id: `workspace-backup-${makeId()}`,
        name: backupName,
        description: `Резервная копия создана перед заменой этого рабочего пространства данными из «${incoming.name}».`.slice(0, 500),
        createdAt: now,
        updatedAt: now,
      }
      const replacement = workspaceSchema.parse({ ...incoming, id: current.id, updatedAt: now })
      writeAttempted = true
      await replaceWorkspaceWithBackup(current, replacement, backup)
      lastWriteSucceeded = true
      set((state) => ({
        workspace: replacement,
        workspaces: upsertSummary(upsertSummary(state.workspaces, backup), replacement),
        selectedNodeId: null,
        isReady: true,
        saveStatus: 'saved',
        storageError: null,
      }))
      return { success: true, mode, backupName }
    } catch (error) {
      if (writeAttempted) lastWriteSucceeded = false
      set({ isReady: true, saveStatus: lastWriteSucceeded ? 'saved' : 'error' })
      return {
        success: false,
        message: getLocalizedFailureMessage(error, 'Не удалось завершить импорт. Существующие данные не заменены. Проверьте доступ к хранилищу браузера и повторите попытку.'),
      }
    }
  },

  updateWorkspaceName: (name) => set((state) => {
    const cleaned = name.trim().slice(0, 100)
    if (!cleaned || cleaned === state.workspace.name) return {}
    const workspace = withUpdatedAt(state.workspace, { name: cleaned })
    scheduleSave(workspace, set)
    return { workspace, workspaces: upsertSummary(state.workspaces, workspace), saveStatus: 'unsaved' }
  }),

  updateWorkspaceSettings: (settings) => set((state) => {
    const workspace = withUpdatedAt(state.workspace, {
      settings: { ...state.workspace.settings, ...settings },
    })
    const parsed = workspaceSchema.safeParse(workspace)
    if (!parsed.success) return {}
    scheduleSave(parsed.data, set)
    return { workspace: parsed.data, workspaces: upsertSummary(state.workspaces, parsed.data), saveStatus: 'unsaved' }
  }),

  switchWorkspace: async (id) => {
    const current = get()
    if (!current.isReady) return false
    if (current.workspace.id === id) return true

    set({ isReady: false })
    if (!(await flushPendingSave())) {
      set({ isReady: true, saveStatus: 'error' })
      return false
    }

    set({ saveStatus: 'loading' })
    try {
      const stored = await readWorkspace(id)
      if (!stored) throw new Error('Рабочее пространство не найдено')
      const workspace = workspaceSchema.parse(stored)
      lastWriteSucceeded = true
      rememberActiveWorkspace(workspace.id)
      set((state) => ({
        workspace,
        workspaces: upsertSummary(state.workspaces, workspace),
        selectedNodeId: null,
        isReady: true,
        saveStatus: 'saved',
      }))
      return true
    } catch {
      lastWriteSucceeded = false
      set({ isReady: true, saveStatus: 'error' })
      return false
    }
  },

  createWorkspace: async (name = 'Новое рабочее пространство') => {
    if (!get().isReady) return false
    set({ isReady: false })
    if (!(await flushPendingSave())) {
      set({ isReady: true, saveStatus: 'error' })
      return false
    }

    const now = new Date().toISOString()
    const cleanedName = name.trim().slice(0, 100) || 'Новое рабочее пространство'
    const workspace: Workspace = {
      id: `workspace-${makeId()}`,
      name: cleanedName,
      description: '',
      nodes: [],
      edges: [],
      architectureNotes: [],
      settings: { defaultView: 'canvas' },
      createdAt: now,
      updatedAt: now,
    }

    set({ saveStatus: 'saving' })
    try {
      await writeWorkspace(workspace)
      lastWriteSucceeded = true
      rememberActiveWorkspace(workspace.id)
      set((state) => ({
        workspace,
        workspaces: upsertSummary(state.workspaces, workspace),
        selectedNodeId: null,
        isReady: true,
        saveStatus: 'saved',
      }))
      return true
    } catch {
      lastWriteSucceeded = false
      set({ isReady: true, saveStatus: 'error' })
      return false
    }
  },
}))
