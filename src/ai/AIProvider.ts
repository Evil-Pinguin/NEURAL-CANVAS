import type { NodeType, RelationType } from '../domain/model'

/** Capabilities are contracts only; they do not imply an installed model or working feature. */
export const aiCapabilities = [
  'idea-generation',
  'node-expansion',
  'project-to-task-breakdown',
  'connection-suggestions',
  'knowledge-summary',
  'study-plan',
  'question-generation',
  'contradiction-analysis',
  'tag-suggestions',
  'node-creation-from-text',
  'structured-import',
] as const

export type AICapability = (typeof aiCapabilities)[number]

/** Deliberately minimized context: providers never receive the persisted workspace object. */
export type AIContext = {
  nodes: readonly {
    id: string
    type: NodeType
    title: string
    description: string
    tags: readonly string[]
  }[]
  relations: readonly {
    sourceId: string
    targetId: string
    relationType: RelationType
    label: string
  }[]
}

/** Every provider request must be preceded by an explicit, scoped user consent action. */
export type AIUserConsent = {
  granted: true
  grantedAt: string
  scope: 'provided-context'
}

export type AIProviderRequest = {
  context: AIContext
  consent: AIUserConsent
  prompt?: string
}

export type AIProviderResponse<T> = {
  proposal: T
  caveats: string[]
}

export type AISuggestedNode = {
  type: NodeType
  title: string
  description: string
  tags: string[]
}

export type AIProposedConnection = {
  sourceId: string
  targetId: string
  relationType: RelationType
  label: string
  rationale: string
}

export type AIExpansionProposal = {
  nodes: AISuggestedNode[]
  connections: AIProposedConnection[]
}

export type AIProjectBreakdownProposal = {
  tasks: Array<{
    title: string
    description: string
    priority: 'low' | 'medium' | 'high' | 'critical'
    dependsOnTaskTitles: string[]
  }>
}

export type AIKnowledgeSummaryProposal = {
  summary: string
  includedNodeIds: string[]
}

export type AIStudyPlanProposal = {
  sessions: Array<{
    title: string
    objective: string
    durationMinutes: number
    nodeIds: string[]
  }>
}

export type AIContradictionProposal = {
  firstNodeId: string
  secondNodeId: string
  explanation: string
}

export type AIStructuredImportProposal = {
  nodes: Array<AISuggestedNode & { tempId: string }>
  connections: Array<{
    sourceTempId: string
    targetTempId: string
    relationType: RelationType
    label: string
  }>
}

/**
 * Replaceable optional extension point for future AI integrations.
 * Provider implementations must keep API secrets server-side, request explicit consent before
 * transmitting data, send only the selected/relevant context, and return proposals for review—
 * never write nodes or connections automatically.
 */
export interface AIProvider {
  readonly id: string
  readonly displayName: string
  readonly capabilities: readonly AICapability[]

  generateIdeas?(request: AIProviderRequest): Promise<AIProviderResponse<AISuggestedNode[]>>
  expandNode?(request: AIProviderRequest): Promise<AIProviderResponse<AIExpansionProposal>>
  breakdownProject?(request: AIProviderRequest): Promise<AIProviderResponse<AIProjectBreakdownProposal>>
  suggestConnections?(request: AIProviderRequest): Promise<AIProviderResponse<AIProposedConnection[]>>
  summarizeKnowledge?(request: AIProviderRequest): Promise<AIProviderResponse<AIKnowledgeSummaryProposal>>
  createStudyPlan?(request: AIProviderRequest): Promise<AIProviderResponse<AIStudyPlanProposal>>
  generateQuestions?(request: AIProviderRequest): Promise<AIProviderResponse<string[]>>
  analyzeContradictions?(request: AIProviderRequest): Promise<AIProviderResponse<AIContradictionProposal[]>>
  suggestTags?(request: AIProviderRequest): Promise<AIProviderResponse<string[]>>
  createNodesFromText?(request: AIProviderRequest): Promise<AIProviderResponse<AISuggestedNode[]>>
  importStructuredData?(request: AIProviderRequest): Promise<AIProviderResponse<AIStructuredImportProposal>>
}

/** A tiny observable slot lets a host application replace or remove its provider at runtime. */
export class AIProviderRegistry {
  private provider: AIProvider | null = null
  private readonly listeners = new Set<() => void>()

  getProvider = (): AIProvider | null => this.provider

  replaceProvider = (provider: AIProvider | null): void => {
    if (this.provider === provider) return
    this.provider = provider
    this.listeners.forEach((listener) => listener())
  }

  setProvider = (provider: AIProvider | null): void => this.replaceProvider(provider)

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}

/** Empty by design: no AI model is bundled or called by Neural Canvas. */
export const aiProviderRegistry = new AIProviderRegistry()
