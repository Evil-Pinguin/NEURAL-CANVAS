import { z } from 'zod'

export const nodeTypes = [
  'idea',
  'concept',
  'knowledge',
  'project',
  'task',
  'note',
  'resource',
  'question',
  'hypothesis',
  'decision',
] as const

/** Kept as a naming alias for existing UI/filter code; persisted nodes use `type`. */
export const nodeKinds = nodeTypes
export const knowledgeNodeTypes: readonly NodeType[] = ['idea', 'concept', 'knowledge', 'note', 'resource', 'question', 'hypothesis', 'decision']
export const nodeStatuses = ['active', 'in-progress', 'planned', 'done', 'archived'] as const
export const nodePriorities = ['low', 'medium', 'high', 'critical'] as const
export const projectStatuses = ['idea', 'planning', 'in-progress', 'on-hold', 'completed', 'archived'] as const
export const developerTaskStatuses = ['backlog', 'todo', 'in-progress', 'done'] as const
export const architectureNoteTypes = ['technical-decision', 'architecture', 'api-endpoint', 'documentation', 'algorithm', 'code', 'question'] as const
export const workspaceViews = ['overview', 'canvas', 'graph-intelligence', 'knowledge', 'developer', 'projects', 'tasks', 'notes', 'recent', 'favorites', 'trash'] as const
export const nodeColors = ['violet', 'blue', 'cyan', 'green', 'amber', 'rose', 'slate'] as const
export const relationTypes = [
  'related_to',
  'depends_on',
  'part_of',
  'implements',
  'contradicts',
  'supports',
  'references',
  'derived_from',
  'blocks',
  'custom',
] as const

export type NodeType = (typeof nodeTypes)[number]
export type NodeKind = NodeType
export type NodeStatus = (typeof nodeStatuses)[number]
export type NodePriority = (typeof nodePriorities)[number]
export type NodeColor = (typeof nodeColors)[number]
export type RelationType = (typeof relationTypes)[number]
export type ProjectStatus = (typeof projectStatuses)[number]
export type DeveloperTaskStatus = (typeof developerTaskStatuses)[number]
export type ArchitectureNoteType = (typeof architectureNoteTypes)[number]
export type WorkspaceView = (typeof workspaceViews)[number]
export type CustomProperty = z.infer<typeof customPropertySchema>
export type RelationMetadata = Record<string, unknown>

export const nodeTypeLabels: Record<NodeType, string> = {
  idea: 'Идея',
  concept: 'Концепция',
  knowledge: 'Знание',
  project: 'Проект',
  task: 'Задача',
  note: 'Заметка',
  resource: 'Ресурс',
  question: 'Вопрос',
  hypothesis: 'Гипотеза',
  decision: 'Решение',
}

/** Compatibility alias for older component naming; labels describe node `type`s. */
export const kindLabels = nodeTypeLabels

export const newNodeTitleLabels: Record<NodeType, string> = {
  idea: 'Новая идея',
  concept: 'Новая концепция',
  knowledge: 'Новая запись о знании',
  project: 'Новый проект',
  task: 'Новая задача',
  note: 'Новая заметка',
  resource: 'Новый ресурс',
  question: 'Новый вопрос',
  hypothesis: 'Новая гипотеза',
  decision: 'Новое решение',
}

export const priorityLabels: Record<NodePriority, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
  critical: 'Критический',
}

export const nodeColorLabels: Record<NodeColor, string> = {
  violet: 'Фиолетовый',
  blue: 'Синий',
  cyan: 'Бирюзовый',
  green: 'Зелёный',
  amber: 'Янтарный',
  rose: 'Розовый',
  slate: 'Серый',
}

export const nodeColorHex: Record<NodeColor, string> = {
  violet: '#a58cf7',
  blue: '#7ba2eb',
  cyan: '#72d4e2',
  green: '#81d6aa',
  amber: '#dfba6e',
  rose: '#d997bc',
  slate: '#9da7bc',
}

export const defaultNodeColor: Record<NodeType, NodeColor> = {
  idea: 'violet',
  concept: 'blue',
  knowledge: 'cyan',
  project: 'rose',
  task: 'cyan',
  note: 'green',
  resource: 'amber',
  question: 'blue',
  hypothesis: 'violet',
  decision: 'rose',
}

export const relationTypeLabels: Record<RelationType, string> = {
  related_to: 'Связано с',
  depends_on: 'Зависит от',
  part_of: 'Часть',
  implements: 'Реализует',
  contradicts: 'Противоречит',
  supports: 'Поддерживает',
  references: 'Ссылается на',
  derived_from: 'Выведено из',
  blocks: 'Блокирует',
  custom: 'Другая связь',
}

export const defaultRelationLabels: Record<RelationType, string> = relationTypeLabels

/** The edge label is the visible caption; relationType remains the semantic graph relation. */
export function getRelationCaption(edge: Pick<CanvasEdgeData, 'relationType' | 'label'>): string {
  return edge.label.trim() || relationTypeLabels[edge.relationType]
}

/** These relations describe dependency or containment and must remain acyclic. */
export const acyclicRelationTypes = ['depends_on', 'part_of', 'blocks'] as const satisfies readonly RelationType[]

export const customPropertySchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(48),
  value: z.string().max(1200),
}).strict()

export const canvasNodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(nodeTypes),
  title: z.string().trim().min(1).max(180),
  description: z.string().max(5000),
  markdownContent: z.string().max(100000).optional(),
  tags: z.array(z.string().trim().min(1).max(48)).max(20),
  color: z.enum(nodeColors),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  position: z.object({ x: z.number().finite(), y: z.number().finite() }).strict(),
  favorite: z.boolean(),
  properties: z.array(customPropertySchema).max(30),
  status: z.enum(nodeStatuses),
  priority: z.enum(nodePriorities),
  projectStatus: z.enum(projectStatuses).optional(),
  techStack: z.array(z.string().trim().min(1).max(48)).max(30).optional(),
  repositoryUrl: z.string().max(2048).optional(),
  demoUrl: z.string().max(2048).optional(),
  taskStatus: z.enum(developerTaskStatuses).optional(),
  dueDate: z.string().date().nullable().optional(),
  projectId: z.string().min(1).nullable().optional(),
  deletedAt: z.string().datetime().optional(),
}).strict()

export const canvasEdgeSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  targetId: z.string().min(1),
  relationType: z.enum(relationTypes),
  label: z.string().trim().min(1).max(80),
  createdAt: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
}).strict()

export const architectureNoteSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(180),
  type: z.enum(architectureNoteTypes),
  projectId: z.string().min(1).nullable(),
  content: z.string().max(20000),
  url: z.string().max(2048),
  code: z.string().max(50000),
  codeLanguage: z.string().trim().min(1).max(40),
  tags: z.array(z.string().trim().min(1).max(48)).max(20),
  relatedNodeIds: z.array(z.string().min(1)).max(100),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict()

export const workspaceSettingsSchema = z.object({
  defaultView: z.enum(workspaceViews).default('canvas'),
}).strict()
export type WorkspaceSettings = z.infer<typeof workspaceSettingsSchema>
export const defaultWorkspaceSettings: WorkspaceSettings = { defaultView: 'canvas' }

export type CanvasNodeData = z.infer<typeof canvasNodeSchema>
export type CanvasEdgeData = z.infer<typeof canvasEdgeSchema>
export type ArchitectureNote = z.infer<typeof architectureNoteSchema>
export type Workspace = z.infer<typeof workspaceSchema>

export type WorkspaceFilters = { kind: 'all' | NodeKind; status: 'all' | NodeStatus }

const workspaceObjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  description: z.string().max(500),
  nodes: z.array(canvasNodeSchema).max(2000),
  edges: z.array(canvasEdgeSchema).max(5000),
  architectureNotes: z.array(architectureNoteSchema).max(1000).default([]),
  settings: workspaceSettingsSchema.default(defaultWorkspaceSettings),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict()

const epoch = '1970-01-01T00:00:00.000Z'
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isNodeType = (value: unknown): value is NodeType => typeof value === 'string' && (nodeTypes as readonly string[]).includes(value)
const isRelationType = (value: unknown): value is RelationType => typeof value === 'string' && (relationTypes as readonly string[]).includes(value)

/** Normalize locally stored v1 workspaces and older JSON exports into the strict graph model. */
function migrateWorkspaceData(input: unknown): unknown {
  if (!isRecord(input)) return input
  const fallbackTimestamp = [input.updatedAt, input.createdAt].find((value) =>
    typeof value === 'string' && z.string().datetime().safeParse(value).success,
  ) as string | undefined ?? epoch

  const nodes = Array.isArray(input.nodes) ? input.nodes.map((value) => {
    if (!isRecord(value)) return value
    const isLegacyNode = 'kind' in value || 'customProperties' in value
    const normalized: Record<string, unknown> = { ...value }
    if (normalized.type === undefined && 'kind' in value) normalized.type = value.kind
    if (normalized.markdownContent === undefined && normalized.type === 'note') {
      normalized.markdownContent = typeof normalized.description === 'string' ? normalized.description : ''
    }
    if (normalized.properties === undefined) {
      if (Array.isArray(value.customProperties)) normalized.properties = value.customProperties
      else if (isLegacyNode) normalized.properties = []
    }
    if (isLegacyNode && normalized.color === undefined && isNodeType(normalized.type)) {
      normalized.color = defaultNodeColor[normalized.type]
    }
    if (isLegacyNode && typeof normalized.favorite !== 'boolean') normalized.favorite = false
    delete normalized.kind
    delete normalized.customProperties
    return normalized
  }) : input.nodes

  const edges = Array.isArray(input.edges) ? input.edges.map((value) => {
    if (!isRecord(value)) return value
    const isLegacyEdge = 'source' in value || 'target' in value
    const rawRelationType = value.relationType
    const rawLabel = value.label
    const normalized: Record<string, unknown> = { ...value }
    if (normalized.sourceId === undefined && 'source' in value) normalized.sourceId = value.source
    if (normalized.targetId === undefined && 'target' in value) normalized.targetId = value.target
    if (isLegacyEdge) {
      const relationType: RelationType = isRelationType(rawRelationType)
        ? rawRelationType
        : rawRelationType === undefined ? 'related_to' : 'custom'
      normalized.relationType = relationType
      normalized.label = typeof rawLabel === 'string' && rawLabel.trim() ? rawLabel : relationTypeLabels[relationType]
      normalized.createdAt = value.createdAt ?? fallbackTimestamp
    }
    delete normalized.source
    delete normalized.target
    return normalized
  }) : input.edges

  return {
    ...input,
    nodes,
    edges,
    settings: input.settings === undefined ? defaultWorkspaceSettings : input.settings,
  }
}

export function wouldCreateRelationCycle(
  edges: readonly Pick<CanvasEdgeData, 'sourceId' | 'targetId' | 'relationType'>[],
  sourceId: string,
  targetId: string,
  relationType: RelationType,
): boolean {
  if (!(acyclicRelationTypes as readonly RelationType[]).includes(relationType)) return false
  if (sourceId === targetId) return true

  const outgoing = new Map<string, string[]>()
  edges.forEach((edge) => {
    if (edge.relationType !== relationType) return
    const targets = outgoing.get(edge.sourceId) ?? []
    targets.push(edge.targetId)
    outgoing.set(edge.sourceId, targets)
  })

  const pending = [targetId]
  const visited = new Set<string>()
  while (pending.length > 0) {
    const current = pending.pop()
    if (!current || visited.has(current)) continue
    if (current === sourceId) return true
    visited.add(current)
    pending.push(...(outgoing.get(current) ?? []))
  }
  return false
}

export const workspaceSchema = z.preprocess(migrateWorkspaceData, workspaceObjectSchema).superRefine((workspace, ctx) => {
  const nodeIds = new Set<string>()
  const nodesById = new Map<string, CanvasNodeData>()
  workspace.nodes.forEach((node, index) => {
    if (nodeIds.has(node.id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['nodes', index, 'id'], message: 'Идентификаторы узлов должны быть уникальными.' })
    }
    nodeIds.add(node.id)
    nodesById.set(node.id, node)
    if (node.type === 'task' && node.projectId) {
      const project = nodesById.get(node.projectId) ?? workspace.nodes.find((item) => item.id === node.projectId)
      if (project?.type !== 'project') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['nodes', index, 'projectId'], message: 'Задачу можно связать только с существующим проектом.' })
      }
    }
  })

  const architectureNoteIds = new Set<string>()
  workspace.architectureNotes.forEach((note, index) => {
    if (architectureNoteIds.has(note.id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['architectureNotes', index, 'id'], message: 'Идентификаторы архитектурных заметок должны быть уникальными.' })
    }
    architectureNoteIds.add(note.id)
    if (note.projectId && nodesById.get(note.projectId)?.type !== 'project') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['architectureNotes', index, 'projectId'], message: 'Архитектурная заметка должна ссылаться на существующий проект.' })
    }
    note.relatedNodeIds.forEach((nodeId, relatedIndex) => {
      if (!nodesById.has(nodeId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['architectureNotes', index, 'relatedNodeIds', relatedIndex], message: 'Архитектурные заметки могут ссылаться только на существующие узлы графа.' })
      }
    })
  })

  const edgeIds = new Set<string>()
  workspace.edges.forEach((edge, index) => {
    if (edgeIds.has(edge.id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['edges', index, 'id'], message: 'Идентификаторы связей должны быть уникальными.' })
    }
    edgeIds.add(edge.id)
    if (!nodeIds.has(edge.sourceId) || !nodeIds.has(edge.targetId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['edges', index], message: 'Связи должны вести к существующим исходному и целевому узлам.' })
    }
    if (edge.sourceId === edge.targetId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['edges', index], message: 'Нельзя соединить узел с самим собой.' })
    }
  })

  acyclicRelationTypes.forEach((relationType) => {
    const relationEdges = workspace.edges.flatMap((edge, index) => edge.relationType === relationType ? [{ edge, index }] : [])
    if (relationEdges.length === 0) return

    const outgoing = new Map<string, string[]>()
    const inDegree = new Map<string, number>()
    const relationNodeIds = new Set<string>()
    relationEdges.forEach(({ edge }) => {
      if (edge.sourceId === edge.targetId) return
      relationNodeIds.add(edge.sourceId)
      relationNodeIds.add(edge.targetId)
      const targets = outgoing.get(edge.sourceId) ?? []
      targets.push(edge.targetId)
      outgoing.set(edge.sourceId, targets)
      inDegree.set(edge.targetId, (inDegree.get(edge.targetId) ?? 0) + 1)
      if (!inDegree.has(edge.sourceId)) inDegree.set(edge.sourceId, 0)
    })

    const pending = [...relationNodeIds].filter((id) => (inDegree.get(id) ?? 0) === 0)
    let visitedCount = 0
    while (pending.length > 0) {
      const current = pending.pop()
      if (!current) continue
      visitedCount += 1
      for (const targetId of outgoing.get(current) ?? []) {
        const nextDegree = (inDegree.get(targetId) ?? 0) - 1
        inDegree.set(targetId, nextDegree)
        if (nextDegree === 0) pending.push(targetId)
      }
    }

    if (visitedCount < relationNodeIds.size) {
      const offendingEdge = relationEdges.find(({ edge }) => edge.sourceId !== edge.targetId)
      if (offendingEdge) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['edges', offendingEdge.index, 'relationType'],
          message: `Связь «${relationTypeLabels[relationType]}» не может создавать цикл.`,
        })
      }
    }
  })
})

export const statusLabels: Record<NodeStatus, string> = {
  active: 'Активно',
  'in-progress': 'В работе',
  planned: 'Запланировано',
  done: 'Завершено',
  archived: 'В архиве',
}

export const projectStatusLabels: Record<ProjectStatus, string> = {
  idea: 'Идея',
  planning: 'Планирование',
  'in-progress': 'В работе',
  'on-hold': 'Приостановлен',
  completed: 'Завершён',
  archived: 'В архиве',
}

export const developerTaskStatusLabels: Record<DeveloperTaskStatus, string> = {
  backlog: 'В очереди',
  todo: 'К выполнению',
  'in-progress': 'В работе',
  done: 'Готово',
}

export const architectureNoteTypeLabels: Record<ArchitectureNoteType, string> = {
  'technical-decision': 'Техническое решение',
  architecture: 'Архитектура',
  'api-endpoint': 'Метод API',
  documentation: 'Документация',
  algorithm: 'Алгоритм',
  code: 'Фрагмент кода',
  question: 'Вопрос для изучения',
}

export const newArchitectureNoteTitleLabels: Record<ArchitectureNoteType, string> = {
  'technical-decision': 'Новое техническое решение',
  architecture: 'Новая архитектурная заметка',
  'api-endpoint': 'Новый метод API',
  documentation: 'Новая заметка с документацией',
  algorithm: 'Новый алгоритм',
  code: 'Новый фрагмент кода',
  question: 'Новый вопрос для изучения',
}

export function toNodeStatus(taskStatus: DeveloperTaskStatus): NodeStatus {
  if (taskStatus === 'backlog') return 'planned'
  if (taskStatus === 'todo') return 'active'
  if (taskStatus === 'in-progress') return 'in-progress'
  return 'done'
}

export function toDeveloperTaskStatus(status: NodeStatus): DeveloperTaskStatus {
  if (status === 'active') return 'todo'
  if (status === 'in-progress') return 'in-progress'
  if (status === 'done' || status === 'archived') return 'done'
  return 'backlog'
}

export function toNodeProjectStatus(status: ProjectStatus): NodeStatus {
  if (status === 'in-progress') return 'in-progress'
  if (status === 'completed') return 'done'
  if (status === 'archived') return 'archived'
  return 'planned'
}

export function toProjectStatus(status: NodeStatus): ProjectStatus {
  if (status === 'in-progress') return 'in-progress'
  if (status === 'done') return 'completed'
  if (status === 'archived') return 'archived'
  if (status === 'active') return 'idea'
  return 'planning'
}

export function getNodeContent(node: Pick<CanvasNodeData, 'type' | 'description' | 'markdownContent'>): string {
  return node.type === 'note' ? node.markdownContent ?? node.description : node.description
}

export function getTaskStatus(node: Pick<CanvasNodeData, 'taskStatus' | 'status'>): DeveloperTaskStatus {
  return node.taskStatus ?? toDeveloperTaskStatus(node.status)
}

export function getProjectStatus(node: Pick<CanvasNodeData, 'projectStatus' | 'status'>): ProjectStatus {
  return node.projectStatus ?? toProjectStatus(node.status)
}
