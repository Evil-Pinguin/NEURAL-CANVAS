import type { CanvasNodeData, WorkspaceFilters } from '../domain/model'
import { getNodeContent, kindLabels, priorityLabels, statusLabels } from '../domain/model'

export function matchesNodeQuery(node: CanvasNodeData, query: string): boolean {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  if (!normalizedQuery) return true
  return [
    node.title,
    getNodeContent(node),
    ...node.tags,
    ...(node.techStack ?? []),
    kindLabels[node.type],
    statusLabels[node.status],
    node.projectStatus ?? '',
    node.taskStatus ?? '',
    node.priority,
    priorityLabels[node.priority],
    node.repositoryUrl ?? '',
    node.demoUrl ?? '',
    node.dueDate ?? '',
  ]
    .join(' ')
    .toLocaleLowerCase()
    .includes(normalizedQuery)
}

export function matchesNodeFilters(node: CanvasNodeData, filters: WorkspaceFilters): boolean {
  return (filters.kind === 'all' || node.type === filters.kind)
    && (filters.status === 'all' || node.status === filters.status)
}

export function matchesNode(node: CanvasNodeData, query: string, filters: WorkspaceFilters): boolean {
  return matchesNodeQuery(node, query) && matchesNodeFilters(node, filters)
}
