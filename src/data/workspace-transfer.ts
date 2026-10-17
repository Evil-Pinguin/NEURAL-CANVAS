import { z } from 'zod'
import {
  wouldCreateRelationCycle,
  workspaceSchema,
  type ArchitectureNote,
  type CanvasEdgeData,
  type CanvasNodeData,
  type Workspace,
} from '../domain/model'

export const WORKSPACE_EXPORT_FORMAT = 'neural-canvas-workspace' as const
export const WORKSPACE_EXPORT_VERSION = 2 as const

const version1WorkspaceExportSchema = z.object({
  format: z.literal(WORKSPACE_EXPORT_FORMAT),
  version: z.literal(1),
  exportedAt: z.string().datetime(),
  workspace: workspaceSchema,
}).strict()

export const workspaceExportSchema = z.object({
  format: z.literal(WORKSPACE_EXPORT_FORMAT),
  version: z.literal(WORKSPACE_EXPORT_VERSION),
  exportedAt: z.string().datetime(),
  workspace: workspaceSchema,
}).strict()

export type WorkspaceExport = z.infer<typeof workspaceExportSchema>
export type WorkspaceImport = { workspace: Workspace; legacy: boolean }
export type WorkspaceMergeStats = {
  addedNodes: number
  addedEdges: number
  addedArchitectureNotes: number
  skippedDuplicateRecords: number
  skippedCyclicEdges: number
}

export function createWorkspaceExport(workspace: Workspace, exportedAt = new Date().toISOString()): WorkspaceExport {
  return workspaceExportSchema.parse({
    format: WORKSPACE_EXPORT_FORMAT,
    version: WORKSPACE_EXPORT_VERSION,
    exportedAt,
    workspace,
  })
}

/** Accept v1/v2 versioned backups and legacy unversioned workspace JSON. */
export function parseWorkspaceImport(value: unknown): WorkspaceImport {
  if (isRecord(value) && ('format' in value || 'version' in value)) {
    if (value.format !== WORKSPACE_EXPORT_FORMAT) {
      throw new Error('Этот файл не является резервной копией рабочего пространства Нейро-холст.')
    }
    if (value.version !== 1 && value.version !== WORKSPACE_EXPORT_VERSION) {
      const suppliedVersion = typeof value.version === 'number' ? value.version : 'неизвестна'
      throw new Error(`Версия резервной копии ${suppliedVersion} не поддерживается. Приложение поддерживает версии 1 и ${WORKSPACE_EXPORT_VERSION}.`)
    }

    const parsed = value.version === 1
      ? version1WorkspaceExportSchema.safeParse(value)
      : workspaceExportSchema.safeParse(value)
    if (!parsed.success) throw new Error(formatValidationError(parsed.error))
    return { workspace: parsed.data.workspace, legacy: false }
  }

  const parsed = workspaceSchema.safeParse(value)
  if (!parsed.success) throw new Error(formatValidationError(parsed.error))
  return { workspace: parsed.data, legacy: true }
}

export function formatValidationError(error: z.ZodError): string {
  const translatedSegments: Record<string, string> = {
    format: 'формат файла', version: 'версия файла', exportedAt: 'дата экспорта',
    workspace: 'рабочее пространство', nodes: 'узлы', edges: 'связи', architectureNotes: 'архитектурные заметки',
    settings: 'настройки', defaultView: 'стартовый раздел', id: 'идентификатор', name: 'название', description: 'описание', title: 'заголовок',
    type: 'тип', position: 'расположение', x: 'координата X', y: 'координата Y', width: 'ширина', height: 'высота',
    frameSize: 'размер рамки', tags: 'теги', color: 'цвет', favorite: 'избранное',
    status: 'статус', priority: 'приоритет', sourceId: 'исходный узел', targetId: 'целевой узел', label: 'название связи',
    relationType: 'тип связи', projectId: 'проект', relatedNodeIds: 'связанные узлы', content: 'содержание',
    url: 'ссылка', code: 'код', codeLanguage: 'язык кода', properties: 'свойства', value: 'значение', property: 'свойство',
    createdAt: 'дата создания', updatedAt: 'дата изменения', deletedAt: 'дата удаления', dueDate: 'срок выполнения',
    markdownContent: 'содержимое заметки', projectStatus: 'статус проекта', taskStatus: 'статус задачи', techStack: 'список технологий',
    repositoryUrl: 'адрес репозитория', demoUrl: 'адрес демо-версии', metadata: 'метаданные',
  }
  const translateMessage = (message: string) => {
    if (message === 'Required' || /received undefined/i.test(message)) return 'обязательное поле не заполнено.'
    const tooShort = message.match(/(?:at least|contain at least)\s*(\d+)\s*(?:character|element|item)/i)
    if (tooShort) return `значение меньше допустимого минимума (${tooShort[1]}).`
    const tooLong = message.match(/(?:at most|contain at most)\s*(\d+)\s*(?:character|element|item)/i)
    if (tooLong) return `значение превышает допустимый максимум (${tooLong[1]}).`
    if (/too small|must be greater than|less than the minimum/i.test(message)) return 'значение меньше допустимого минимума.'
    if (/too big|must be less than|greater than the maximum/i.test(message)) return 'значение превышает допустимый максимум.'
    if (/invalid (?:date|datetime|iso datetime|uuid)/i.test(message)) return 'неверный формат даты, времени или идентификатора.'
    if (/invalid (?:url|email)/i.test(message)) return 'неверный формат ссылки или адреса электронной почты.'
    if (/invalid enum value|invalid option/i.test(message)) return 'недопустимое значение.'
    if (/unrecognized key/i.test(message)) return 'содержит неизвестные поля.'
    if (/received undefined/i.test(message)) return 'обязательное поле не заполнено.'
    if (/expected .* received/i.test(message)) return 'значение имеет неверный тип.'
    if (/must be finite/i.test(message)) return 'число должно быть конечным.'
    return message && /[А-Яа-яЁё]/.test(message) ? message : 'данные не соответствуют ожидаемому формату.'
  }

  return error.issues.slice(0, 4).map((issue) => {
    const path = issue.path.length
      ? issue.path.map((segment) => typeof segment === 'number' ? `запись ${segment + 1}` : translatedSegments[String(segment)] ?? String(segment)).join(' → ')
      : translatedSegments.workspace
    return `${path}: ${translateMessage(issue.message)}`
  }).join(' ')
}

/**
 * Non-destructive merge. Existing records win on identical IDs; conflicting imported IDs
 * are remapped, and all imported references are rewritten to their new IDs. Dependency
 * edges that would introduce a cycle are skipped instead of invalidating the full import.
 */
export function mergeWorkspaces(existing: Workspace, incoming: Workspace, now = new Date().toISOString()): {
  workspace: Workspace
  stats: WorkspaceMergeStats
} {
  const currentWorkspace = workspaceSchema.parse(existing)
  const sourceWorkspace = workspaceSchema.parse(incoming)
  const currentNodeById = new Map(currentWorkspace.nodes.map((node) => [node.id, node]))
  const usedNodeIds = new Set(currentNodeById.keys())
  const nodeIdMap = new Map<string, string>()
  const importedNodes = new Map<string, CanvasNodeData | null>()
  let skippedDuplicateRecords = 0

  const reserveNodeId = (originalId: string) => {
    let id = makeId()
    while (usedNodeIds.has(id)) id = makeId()
    usedNodeIds.add(id)
    nodeIdMap.set(originalId, id)
    return id
  }

  // Projects are mapped first so task.projectId values can be remapped before comparing tasks.
  for (const node of sourceWorkspace.nodes.filter((item) => item.type === 'project')) {
    const current = currentNodeById.get(node.id)
    const equivalent = current && sameRecord(current, node)
      ? current
      : currentWorkspace.nodes.find((item) => item.type === 'project' && sameRecord(item, node))
    if (equivalent) {
      nodeIdMap.set(node.id, equivalent.id)
      importedNodes.set(node.id, null)
      skippedDuplicateRecords += 1
    } else if (!current) {
      nodeIdMap.set(node.id, node.id)
      usedNodeIds.add(node.id)
      importedNodes.set(node.id, node)
    } else {
      const newId = reserveNodeId(node.id)
      importedNodes.set(node.id, { ...node, id: newId })
    }
  }

  for (const node of sourceWorkspace.nodes.filter((item) => item.type !== 'project')) {
    const mappedProjectId = node.projectId ? nodeIdMap.get(node.projectId) ?? node.projectId : node.projectId
    const candidate: CanvasNodeData = node.type === 'task'
      ? { ...node, projectId: mappedProjectId ?? null }
      : node
    const current = currentNodeById.get(node.id)
    const equivalent = current && sameRecord(current, candidate)
      ? current
      : currentWorkspace.nodes.find((item) => item.type !== 'project' && sameRecord(item, candidate))
    if (equivalent) {
      nodeIdMap.set(node.id, equivalent.id)
      importedNodes.set(node.id, null)
      skippedDuplicateRecords += 1
    } else if (!current) {
      nodeIdMap.set(node.id, node.id)
      usedNodeIds.add(node.id)
      importedNodes.set(node.id, candidate)
    } else {
      const newId = reserveNodeId(node.id)
      importedNodes.set(node.id, { ...candidate, id: newId })
    }
  }

  const nodes = [
    ...currentWorkspace.nodes,
    ...sourceWorkspace.nodes.flatMap((node) => {
      const imported = importedNodes.get(node.id)
      return imported ? [imported] : []
    }),
  ]

  const edges = [...currentWorkspace.edges]
  const usedEdgeIds = new Set(edges.map((edge) => edge.id))
  const edgeSignatureToId = new Map(edges.map((edge) => [edgeSignature(edge), edge.id]))
  let addedEdges = 0
  let skippedCyclicEdges = 0
  for (const edge of sourceWorkspace.edges) {
    const candidate: CanvasEdgeData = {
      ...edge,
      sourceId: nodeIdMap.get(edge.sourceId) ?? edge.sourceId,
      targetId: nodeIdMap.get(edge.targetId) ?? edge.targetId,
    }
    const signature = edgeSignature(candidate)
    if (edgeSignatureToId.has(signature)) {
      skippedDuplicateRecords += 1
      continue
    }
    if (wouldCreateRelationCycle(edges, candidate.sourceId, candidate.targetId, candidate.relationType)) {
      skippedCyclicEdges += 1
      continue
    }
    let id = candidate.id
    if (usedEdgeIds.has(id)) {
      id = makeId()
      while (usedEdgeIds.has(id)) id = makeId()
    }
    const remapped = { ...candidate, id }
    edges.push(remapped)
    usedEdgeIds.add(id)
    edgeSignatureToId.set(signature, id)
    addedEdges += 1
  }

  const architectureNotes = [...currentWorkspace.architectureNotes]
  const currentNoteById = new Map(architectureNotes.map((note) => [note.id, note]))
  const usedNoteIds = new Set(currentNoteById.keys())
  let addedArchitectureNotes = 0
  for (const note of sourceWorkspace.architectureNotes) {
    const candidate: ArchitectureNote = {
      ...note,
      projectId: note.projectId ? nodeIdMap.get(note.projectId) ?? note.projectId : null,
      relatedNodeIds: note.relatedNodeIds.map((id) => nodeIdMap.get(id) ?? id),
    }
    const current = currentNoteById.get(note.id)
    const equivalent = current && sameRecord(current, candidate)
      ? current
      : architectureNotes.find((item) => sameRecord(item, candidate))
    if (equivalent) {
      skippedDuplicateRecords += 1
      continue
    }
    let id = note.id
    if (usedNoteIds.has(id)) {
      id = makeId()
      while (usedNoteIds.has(id)) id = makeId()
    }
    architectureNotes.push({ ...candidate, id })
    usedNoteIds.add(id)
    addedArchitectureNotes += 1
  }

  const parsed = workspaceSchema.safeParse({
    ...currentWorkspace,
    nodes,
    edges,
    architectureNotes,
    updatedAt: now,
  })
  if (!parsed.success) throw new Error(`Не удалось объединить рабочие пространства: ${formatValidationError(parsed.error)}`)

  return {
    workspace: parsed.data,
    stats: {
      addedNodes: nodes.length - currentWorkspace.nodes.length,
      addedEdges,
      addedArchitectureNotes,
      skippedDuplicateRecords,
      skippedCyclicEdges,
    },
  }
}

function edgeSignature(edge: CanvasEdgeData): string {
  return stableStringify({
    sourceId: edge.sourceId,
    targetId: edge.targetId,
    relationType: edge.relationType,
    label: edge.label,
    metadata: edge.metadata,
  })
}

function sameRecord(first: CanvasNodeData | ArchitectureNote, second: CanvasNodeData | ArchitectureNote): boolean {
  const { id: _firstId, ...firstData } = first
  const { id: _secondId, ...secondData } = second
  return stableStringify(firstData) === stableStringify(secondData)
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'undefined'
}

function makeId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
