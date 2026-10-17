import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  CircleDot,
  GitBranch,
  Link2,
  Loader2,
  Network,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { aiCapabilities, aiProviderRegistry, type AICapability } from '../ai/AIProvider'
import { getRelationCaption, kindLabels, nodeTypeLabels, type CanvasNodeData, type Workspace } from '../domain/model'
import { runGraphQuery } from '../utils/graph-intelligence-client'
import { formatRussianCount } from '../utils/locale'
import type {
  GraphDirection,
  GraphNeighborsResult,
  GraphOverview,
  GraphQuery,
  GraphQueryResult,
  GraphShortestPathResult,
  GraphTraversalMethod,
  GraphTraversalResult,
} from '../utils/graph-intelligence'

type GraphIntelligenceProps = {
  workspace: Workspace
  onOpenNode: (id: string) => void
  onFocusGraphSelection?: (nodeIds: string[], edgeIds: string[]) => void
}

type OperationName = 'neighbors' | 'shortest-path' | 'traverse'

const capabilityLabels: Record<AICapability, string> = {
  'idea-generation': 'Создание идей',
  'node-expansion': 'Развитие идеи',
  'project-to-task-breakdown': 'Разбиение проекта на задачи',
  'connection-suggestions': 'Предложения связей',
  'knowledge-summary': 'Краткие обзоры знаний',
  'study-plan': 'Планы обучения',
  'question-generation': 'Создание вопросов',
  'contradiction-analysis': 'Поиск противоречий',
  'tag-suggestions': 'Предложения тегов',
  'node-creation-from-text': 'Создание объектов из текста',
  'structured-import': 'Структурированный импорт',
}

export default function GraphIntelligence({ workspace, onOpenNode, onFocusGraphSelection }: GraphIntelligenceProps) {
  const activeNodes = useMemo(() => workspace.nodes.filter((node) => !node.deletedAt), [workspace.nodes])
  const nodesById = useMemo(() => new Map(activeNodes.map((node) => [node.id, node])), [activeNodes])
  const activeEdges = useMemo(
    () => workspace.edges.filter((edge) => nodesById.has(edge.sourceId) && nodesById.has(edge.targetId)),
    [nodesById, workspace.edges],
  )
  const provider = useSyncExternalStore(
    aiProviderRegistry.subscribe,
    aiProviderRegistry.getProvider,
    aiProviderRegistry.getProvider,
  )

  const [overview, setOverview] = useState<GraphOverview | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [overviewError, setOverviewError] = useState('')
  const [operationBusy, setOperationBusy] = useState<OperationName | null>(null)
  const [operationError, setOperationError] = useState('')
  const [neighborNodeId, setNeighborNodeId] = useState('')
  const [neighbors, setNeighbors] = useState<GraphNeighborsResult | null>(null)
  const [pathStartId, setPathStartId] = useState('')
  const [pathEndId, setPathEndId] = useState('')
  const [pathDirection, setPathDirection] = useState<GraphDirection>('both')
  const [pathResult, setPathResult] = useState<GraphShortestPathResult | null>(null)
  const [traversalStartId, setTraversalStartId] = useState('')
  const [traversalDirection, setTraversalDirection] = useState<GraphDirection>('both')
  const [traversalMethod, setTraversalMethod] = useState<GraphTraversalMethod>('breadth-first')
  const [traversalResult, setTraversalResult] = useState<GraphTraversalResult | null>(null)
  const [isolatedLimit, setIsolatedLimit] = useState(8)
  const [duplicateLimit, setDuplicateLimit] = useState(8)
  const [componentLimit, setComponentLimit] = useState(6)
  const operationController = useRef<AbortController | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setOverview(null)
    setOverviewLoading(true)
    setOverviewError('')
    void runGraphQuery(workspace, { kind: 'overview' }, controller.signal)
      .then((result) => {
        if (result.kind !== 'overview') throw new Error('Не удалось получить сводку по графу.')
        setOverview(result)
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return
        setOverviewError(error instanceof Error && /[А-Яа-яЁё]/u.test(error.message) ? error.message : 'Не удалось завершить анализ графа.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setOverviewLoading(false)
      })
    return () => controller.abort()
  }, [workspace])

  useEffect(() => {
    const validIds = new Set(activeNodes.map((node) => node.id))
    const fallbackId = activeNodes[0]?.id ?? ''
    const secondFallbackId = activeNodes[1]?.id ?? fallbackId
    setNeighborNodeId((current) => (validIds.has(current) ? current : fallbackId))
    setPathStartId((current) => (validIds.has(current) ? current : fallbackId))
    setPathEndId((current) => (validIds.has(current) ? current : secondFallbackId))
    setTraversalStartId((current) => (validIds.has(current) ? current : fallbackId))
    setNeighbors(null)
    setPathResult(null)
    setTraversalResult(null)
    setOperationError('')
    setIsolatedLimit(8)
    setDuplicateLimit(8)
    setComponentLimit(6)
    operationController.current?.abort()
    operationController.current = null
  }, [activeNodes, workspace])

  useEffect(() => () => operationController.current?.abort(), [])

  const selectedDegree = overview?.degreeByNode.find((degree) => degree.nodeId === neighborNodeId)
  const degreeLeaders = useMemo(
    () =>
      (overview?.degreeByNode ?? [])
        .filter((degree) => degree.total > 0)
        .sort(
          (first, second) =>
            second.total - first.total ||
            (nodesById.get(first.nodeId)?.title ?? '').localeCompare(nodesById.get(second.nodeId)?.title ?? ''),
        )
        .slice(0, 8),
    [nodesById, overview],
  )
  const visibleComponents = overview?.connectedComponents.slice(0, componentLimit) ?? []
  const visibleIsolatedIds = overview?.isolatedNodeIds.slice(0, isolatedLimit) ?? []
  const visibleDuplicateGroups = overview?.duplicateTitleGroups.slice(0, duplicateLimit) ?? []

  const runOperation = async (
    operation: OperationName,
    query: GraphQuery,
    applyResult: (result: GraphQueryResult) => void,
  ) => {
    operationController.current?.abort()
    const controller = new AbortController()
    operationController.current = controller
    setOperationBusy(operation)
    setOperationError('')
    try {
      const result = await runGraphQuery(workspace, query, controller.signal)
      if (!controller.signal.aborted) applyResult(result)
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) {
        setOperationError(error instanceof Error && /[А-Яа-яЁё]/u.test(error.message) ? error.message : 'Не удалось завершить анализ графа.')
      }
    } finally {
      if (operationController.current === controller) {
        operationController.current = null
        setOperationBusy(null)
      }
    }
  }

  const handleNeighborSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!neighborNodeId) return
    void runOperation('neighbors', { kind: 'neighbors', nodeId: neighborNodeId }, (result) => {
      if (result.kind === 'neighbors') setNeighbors(result)
    })
  }

  const handlePathSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!pathStartId || !pathEndId) return
    void runOperation(
      'shortest-path',
      {
        kind: 'shortest-path',
        sourceId: pathStartId,
        targetId: pathEndId,
        direction: pathDirection,
      },
      (result) => {
        if (result.kind === 'shortest-path') setPathResult(result)
      },
    )
  }

  const handleTraversalSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!traversalStartId) return
    void runOperation(
      'traverse',
      {
        kind: 'traverse',
        startId: traversalStartId,
        direction: traversalDirection,
        method: traversalMethod,
      },
      (result) => {
        if (result.kind === 'traversal') setTraversalResult(result)
      },
    )
  }

  const focusSelection = (nodeIds: string[], edgeIds: string[]) => {
    if (onFocusGraphSelection && nodeIds.length > 0) {
      onFocusGraphSelection(nodeIds, edgeIds)
      return
    }
    const firstNodeId = nodeIds[0]
    if (firstNodeId) onOpenNode(firstNodeId)
  }

  const showMore = (kind: 'isolated' | 'duplicates' | 'components', available: number) => {
    const nextLimit =
      (kind === 'isolated' ? isolatedLimit : kind === 'duplicates' ? duplicateLimit : componentLimit) + 8
    const limit = Math.min(nextLimit, available)
    if (kind === 'isolated') setIsolatedLimit(limit)
    else if (kind === 'duplicates') setDuplicateLimit(limit)
    else setComponentLimit(limit)
  }

  return (
    <div className="content-page graph-intelligence-page" aria-busy={overviewLoading || operationBusy !== null}>
      <div className="graph-intelligence-header page-header">
        <div>
          <span className="eyebrow">ЛОКАЛЬНЫЕ ИНСТРУМЕНТЫ ГРАФА</span>
          <h1>Анализ графа</h1>
          <p>Изучайте структуру и связи на основе данных рабочего пространства. Анализ выполняется только на этом устройстве.</p>
        </div>
        <div className="graph-intelligence-header__meta">
          <span className="graph-local-badge">
            <Activity size={14} /> Анализ на устройстве
          </span>
          <span className="page-count">
            {overview
              ? `${formatRussianCount(overview.nodeCount, { one: 'узел', few: 'узла', many: 'узлов' })} · ${formatRussianCount(overview.edgeCount, { one: 'связь', few: 'связи', many: 'связей' })}`
              : formatRussianCount(activeNodes.length, { one: 'активный узел', few: 'активных узла', many: 'активных узлов' })}
          </span>
        </div>
      </div>

      {overviewError && (
        <div className="graph-analysis-message graph-analysis-message--error" role="alert">
          {overviewError}
        </div>
      )}
      {overviewLoading && (
        <div className="graph-analysis-message" role="status">
          <Loader2 size={14} className="graph-analysis-spinner" /> Анализ графа рабочего пространства на этом устройстве…
        </div>
      )}
      {operationError && (
        <div className="graph-analysis-message graph-analysis-message--error" role="alert">
          {operationError}
        </div>
      )}

      <section className="graph-stat-grid" aria-label="Статистика графа">
        <GraphStat
          icon={<Network size={16} />}
          label="Активные узлы"
          value={overview?.nodeCount ?? activeNodes.length}
          detail="Не находятся в корзине"
        />
        <GraphStat
          icon={<Link2 size={16} />}
          label="Связи"
          value={overview?.edgeCount ?? activeEdges.length}
          detail="Действующие связи"
        />
        <GraphStat
          icon={<GitBranch size={16} />}
          label="Компоненты"
          value={overview?.componentCount ?? '—'}
          detail="Группы, связанные между собой"
        />
        <GraphStat
          icon={<CircleDot size={16} />}
          label="Изолированные"
          value={overview?.isolatedNodeIds.length ?? '—'}
          detail="Нет входящих и исходящих связей"
        />
        <GraphStat
          icon={<Activity size={16} />}
          label="Среднее число связей"
          value={overview ? overview.averageDegree.toFixed(2) : '—'}
          detail={overview ? `Максимум: ${overview.maximumDegree}` : 'Входящие и исходящие связи на узел'}
        />
      </section>

      <section className="graph-tool-grid" aria-label="Инструменты исследования графа">
        <article className="graph-tool-card">
          <ToolHeading
            icon={<Network size={17} />}
            title="Соседи узла"
            text="Посмотрите входящие и исходящие связи и ближайших соседей узла."
          />
          <form className="graph-tool-form" onSubmit={handleNeighborSubmit}>
            <NodePicker
              label="Центральный узел"
              nodes={activeNodes}
              value={neighborNodeId}
              onChange={(id) => {
                setNeighborNodeId(id)
                setNeighbors(null)
              }}
            />
            <div className="graph-tool-form__footer">
              <div className="graph-degree-strip" aria-label="Количество связей выбранного узла">
                <span>
                  <ArrowDown size={13} /> Входящие <strong>{selectedDegree?.incoming ?? '—'}</strong>
                </span>
                <span>
                  <ArrowUp size={13} /> Исходящие <strong>{selectedDegree?.outgoing ?? '—'}</strong>
                </span>
              </div>
              <button
                className="button-secondary graph-tool-submit"
                type="submit"
                disabled={!neighborNodeId || operationBusy !== null}
                aria-busy={operationBusy === 'neighbors'}
              >
                {operationBusy === 'neighbors' ? (
                  <Loader2 size={14} className="graph-analysis-spinner" aria-hidden="true" />
                ) : (
                  <Search size={14} aria-hidden="true" />
                )}
                {operationBusy === 'neighbors' ? 'Анализ…' : 'Анализировать'}
              </button>
            </div>
          </form>
          {neighbors && (
            <div className="graph-result-panel">
              <div className="graph-result-panel__heading">
                <span>{nodesById.get(neighbors.nodeId)?.title ?? 'Выбранный узел'}</span>
                <button
                  className="graph-text-button"
                  onClick={() => focusSelection([neighbors.nodeId], neighbors.incidentEdgeIds)}
                >
                  Подсветить на холсте
                </button>
              </div>
              <div className="graph-neighbor-columns">
                <NeighborGroup
                  title="Входящие связи от"
                  ids={neighbors.incomingNeighborIds}
                  nodesById={nodesById}
                  onOpenNode={onOpenNode}
                />
                <NeighborGroup
                  title="Исходящие связи к"
                  ids={neighbors.outgoingNeighborIds}
                  nodesById={nodesById}
                  onOpenNode={onOpenNode}
                />
              </div>
              {neighbors.incomingNeighborIds.length === 0 && neighbors.outgoingNeighborIds.length === 0 && (
                <p className="graph-result-empty">У этого узла нет прямых связей.</p>
              )}
            </div>
          )}
        </article>

        <article className="graph-tool-card">
          <ToolHeading
            icon={<GitBranch size={17} />}
            title="Кратчайший путь"
            text="Найдите путь с наименьшим числом связей, учитывая или игнорируя их направление."
          />
          <form className="graph-tool-form" onSubmit={handlePathSubmit}>
            <div className="graph-picker-pair">
              <NodePicker
                label="От узла"
                nodes={activeNodes}
                value={pathStartId}
                onChange={(id) => {
                  setPathStartId(id)
                  setPathResult(null)
                }}
              />
              <NodePicker
                label="К узлу"
                nodes={activeNodes}
                value={pathEndId}
                onChange={(id) => {
                  setPathEndId(id)
                  setPathResult(null)
                }}
              />
            </div>
            <div className="graph-tool-form__footer">
              <DirectionPicker label="Направление пути" value={pathDirection} onChange={setPathDirection} />
              <button
                className="button-secondary graph-tool-submit"
                type="submit"
                disabled={!pathStartId || !pathEndId || operationBusy !== null}
                aria-busy={operationBusy === 'shortest-path'}
              >
                {operationBusy === 'shortest-path' ? (
                  <Loader2 size={14} className="graph-analysis-spinner" aria-hidden="true" />
                ) : (
                  <ArrowRight size={14} aria-hidden="true" />
                )}
                {operationBusy === 'shortest-path' ? 'Поиск пути…' : 'Найти путь'}
              </button>
            </div>
          </form>
          {pathResult && (
            <PathResult
              result={pathResult}
              nodesById={nodesById}
              activeEdges={activeEdges}
              onOpenNode={onOpenNode}
              onHighlight={() => focusSelection(pathResult.nodeIds, pathResult.edgeIds)}
            />
          )}
        </article>

        <article className="graph-tool-card">
          <ToolHeading
            icon={<Activity size={17} />}
            title="Обход графа"
            text="Обойдите доступные узлы в ширину или в глубину."
          />
          <form className="graph-tool-form" onSubmit={handleTraversalSubmit}>
            <NodePicker
              label="Начальный узел"
              nodes={activeNodes}
              value={traversalStartId}
              onChange={(id) => {
                setTraversalStartId(id)
                setTraversalResult(null)
              }}
            />
            <div className="graph-tool-form__footer graph-tool-form__footer--wrap">
              <DirectionPicker
                label="Направление обхода"
                value={traversalDirection}
                onChange={setTraversalDirection}
              />
              <label className="graph-select-control">
                <span>Способ</span>
                <select
                  aria-label="Способ обхода графа"
                  value={traversalMethod}
                  onChange={(event) => {
                    setTraversalMethod(event.target.value as GraphTraversalMethod)
                    setTraversalResult(null)
                  }}
                >
                  <option value="breadth-first">В ширину (BFS)</option>
                  <option value="depth-first">В глубину (DFS)</option>
                </select>
              </label>
              <button
                className="button-secondary graph-tool-submit"
                type="submit"
                disabled={!traversalStartId || operationBusy !== null}
                aria-busy={operationBusy === 'traverse'}
              >
                {operationBusy === 'traverse' ? (
                  <Loader2 size={14} className="graph-analysis-spinner" aria-hidden="true" />
                ) : (
                  <ArrowRight size={14} aria-hidden="true" />
                )}
                {operationBusy === 'traverse' ? 'Обход…' : 'Выполнить обход'}
              </button>
            </div>
          </form>
          {traversalResult && (
            <TraversalResult
              result={traversalResult}
              nodesById={nodesById}
              onOpenNode={onOpenNode}
              onHighlight={() => focusSelection(traversalResult.nodeIds, traversalResult.edgeIds)}
            />
          )}
        </article>

        <article className="graph-tool-card graph-tool-card--degree">
          <ToolHeading
            icon={<Activity size={17} />}
            title="Самые связанные узлы"
            text="Узлы с наибольшим числом связей. При равенстве порядок определяется по названию."
          />
          {overviewLoading ? (
            <p className="graph-section-muted">Подсчёт связей…</p>
          ) : degreeLeaders.length > 0 ? (
            <ol className="graph-degree-list">
              {degreeLeaders.map((degree) => {
                const node = nodesById.get(degree.nodeId)
                if (!node) return null
                return (
                  <li key={degree.nodeId}>
                    <button onClick={() => onOpenNode(node.id)}>
                      <span className="graph-degree-list__title">{node.title}</span>
                      <span
                        className="graph-degree-list__counts"
                        aria-label={`Входящих связей: ${degree.incoming}, исходящих: ${degree.outgoing}`}
                      >
                        <span>
                          Входящие <strong>{degree.incoming}</strong>
                        </span>
                        <span>
                          Исходящие <strong>{degree.outgoing}</strong>
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className="graph-section-muted">Пока нет связанных узлов.</p>
          )}
        </article>
      </section>

      <section className="graph-findings-grid" aria-label="Результаты анализа графа">
        <article className="graph-finding-card">
          <ToolHeading
            icon={<CircleDot size={17} />}
            title="Изолированные узлы"
            text="Активные узлы без входящих и исходящих связей."
            count={overview?.isolatedNodeIds.length}
          />
          {visibleIsolatedIds.length > 0 ? (
            <div className="graph-finding-list">
              {visibleIsolatedIds.map((id) => {
                const node = nodesById.get(id)
                return node ? <FindingNode key={id} node={node} onOpenNode={onOpenNode} /> : null
              })}
              {overview && overview.isolatedNodeIds.length > visibleIsolatedIds.length && (
                <button
                  className="graph-text-button graph-show-more"
                  onClick={() => showMore('isolated', overview.isolatedNodeIds.length)}
                >
                  Показать больше изолированных узлов
                </button>
              )}
            </div>
          ) : (
            <p className="graph-section-muted">{overviewLoading ? 'Проверка связности…' : 'Изолированных узлов нет.'}</p>
          )}
        </article>

        <article className="graph-finding-card">
          <ToolHeading
            icon={<GitBranch size={17} />}
            title="Связные компоненты"
            text="При поиске групп направление связей не учитывается."
            count={overview?.componentCount}
          />
          {visibleComponents.length > 0 ? (
            <div className="graph-component-list">
              {visibleComponents.map((component, index) => {
                const componentIds = new Set(component)
                const componentEdgeIds = activeEdges
                  .filter((edge) => componentIds.has(edge.sourceId) && componentIds.has(edge.targetId))
                  .map((edge) => edge.id)
                return (
                  <details className="graph-component" key={component[0] ?? index}>
                    <summary>
                      <span>Группа {index + 1}</span>
                      <small>
                        {formatRussianCount(component.length, { one: 'узел', few: 'узла', many: 'узлов' })}
                      </small>
                    </summary>
                    <div className="graph-component__body">
                      <div className="graph-component__nodes">
                        {component.slice(0, 12).map((id) => {
                          const node = nodesById.get(id)
                          return node ? (
                            <button key={id} onClick={() => onOpenNode(id)}>
                              {node.title}
                            </button>
                          ) : null
                        })}
                        {component.length > 12 && <span>и ещё {component.length - 12}</span>}
                      </div>
                      <button className="graph-text-button" onClick={() => focusSelection(component, componentEdgeIds)}>
                        Подсветить группу на холсте
                      </button>
                    </div>
                  </details>
                )
              })}
              {overview && overview.connectedComponents.length > visibleComponents.length && (
                <button
                  className="graph-text-button graph-show-more"
                  onClick={() => showMore('components', overview.connectedComponents.length)}
                >
                  Показать больше групп
                </button>
              )}
            </div>
          ) : (
            <p className="graph-section-muted">{overviewLoading ? 'Поиск групп…' : 'Нет групп для отображения.'}</p>
          )}
        </article>

        <article className="graph-finding-card">
          <ToolHeading
            icon={<Search size={17} />}
            title="Возможные совпадения названий"
            text="Показываются только точные совпадения названий. Совпадение названий не означает совпадения смысла."
            count={overview?.duplicateTitleGroups.length}
          />
          {visibleDuplicateGroups.length > 0 ? (
            <div className="graph-duplicate-list">
              {visibleDuplicateGroups.map((group) => (
                <div className="graph-duplicate-group" key={group.normalizedTitle}>
                  <div className="graph-duplicate-group__heading">
                    <strong>{group.titles[0]}</strong>
                    <span>Совпадений названия: {group.nodeIds.length}</span>
                  </div>
                  <div className="graph-duplicate-group__nodes">
                    {group.nodeIds.map((id, index) => {
                      const node = nodesById.get(id)
                      return node ? (
                        <button key={id} onClick={() => onOpenNode(id)}>
                          <span>{node.title}</span>
                          <small>
                            {nodeTypeLabels[node.type]}
                            {index === 0 ? ' · первое совпадение' : ''}
                          </small>
                        </button>
                      ) : null
                    })}
                  </div>
                  <button className="graph-text-button" onClick={() => focusSelection(group.nodeIds, [])}>
                    Проверить на холсте
                  </button>
                </div>
              ))}
              {overview && overview.duplicateTitleGroups.length > visibleDuplicateGroups.length && (
                <button
                  className="graph-text-button graph-show-more"
                  onClick={() => showMore('duplicates', overview.duplicateTitleGroups.length)}
                >
                  Показать больше совпадений
                </button>
              )}
            </div>
          ) : (
            <p className="graph-section-muted">
              {overviewLoading ? 'Проверка названий…' : 'Точных совпадений названий нет.'}
            </p>
          )}
        </article>

        <article className="graph-finding-card graph-finding-card--types">
          <ToolHeading icon={<Network size={17} />} title="Типы узлов" text="Учитываются узлы, не находящиеся в корзине." />
          {overview?.typeCounts.length ? (
            <div className="graph-type-list">
              {overview.typeCounts.map(({ type, count }) => (
                <div key={type}>
                  <span>{kindLabels[type]}</span>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="graph-section-muted">{overviewLoading ? 'Подсчёт узлов…' : 'Активных узлов пока нет.'}</p>
          )}
        </article>
      </section>

      <section className="graph-ai-panel" aria-labelledby="graph-ai-title">
        <div className="graph-ai-panel__top">
          <span className="graph-ai-panel__icon">
            <Sparkles size={18} />
          </span>
          <div className="graph-ai-panel__title">
            <span className="eyebrow">НЕОБЯЗАТЕЛЬНОЕ ДОПОЛНЕНИЕ</span>
            <h2 id="graph-ai-title">Подключение поставщика ИИ</h2>
            <p>
              Позже можно подключить или заменить поставщика ИИ через специальный интерфейс. Сейчас этот экран не генерирует
              ответы ИИ.
            </p>
          </div>
          <div className={`graph-ai-status${provider ? ' is-available' : ''}`} role="status">
            <span />
            {provider
              ? `Поставщик доступен: ${provider.displayName}. Этот экран не отправляет запросы к ИИ.`
              : 'Поставщик ИИ не настроен.'}
          </div>
        </div>
        <div className="graph-ai-panel__body">
          <div className="graph-ai-capabilities" aria-label="Возможности, которые можно будет подключить">
            {aiCapabilities.map((capability) => (
              <div key={capability}>
                <Check size={13} />
                <span>{capabilityLabels[capability]}</span>
                <small>Только описание возможности</small>
              </div>
            ))}
          </div>
          <div className="graph-ai-privacy">
            <div>
              <ShieldCheck size={15} />
              <strong>Защита конфиденциальности</strong>
            </div>
            <p>
              Облачные поставщики должны использовать защищённый сервер, запрашивать явное согласие перед каждой отправкой и
              получать только выбранные необходимые данные. Предложения остаются на рассмотрение пользователя и
              никогда не применяются автоматически.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

function GraphStat({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode
  label: string
  value: number | string
  detail: string
}) {
  return (
    <div className="graph-stat">
      <span className="graph-stat__icon">{icon}</span>
      <span className="graph-stat__label">{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  )
}

function ToolHeading({ icon, title, text, count }: { icon: ReactNode; title: string; text: string; count?: number }) {
  return (
    <div className="graph-tool-heading">
      <span className="graph-tool-heading__icon">{icon}</span>
      <div>
        <div className="graph-tool-heading__title">
          <h2>{title}</h2>
          {count !== undefined && <span>{count}</span>}
        </div>
        <p>{text}</p>
      </div>
    </div>
  )
}

function NodePicker({
  label,
  nodes,
  value,
  onChange,
}: {
  label: string
  nodes: CanvasNodeData[]
  value: string
  onChange: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const listId = useId()
  const selected = nodes.find((node) => node.id === value)
  const matchingNodes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return nodes.slice(0, 8)
    return nodes.filter((node) => `${node.title} ${node.type}`.toLowerCase().includes(normalizedQuery)).slice(0, 8)
  }, [nodes, query])

  const choose = (id: string) => {
    onChange(id)
    setQuery('')
    setOpen(false)
  }

  return (
    <div
      className="graph-node-picker"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
      }}
    >
      <label htmlFor={`${listId}-input`}>{label}</label>
      <div className="graph-node-picker__control">
        <Search size={14} aria-hidden="true" />
        <input
          id={`${listId}-input`}
          type="search"
          autoComplete="off"
          placeholder={nodes.length > 0 ? 'Найти активный узел' : 'Нет активных узлов'}
          aria-label={label}
          aria-expanded={open}
          aria-controls={listId}
          value={open ? query : (selected?.title ?? '')}
          disabled={nodes.length === 0}
          onFocus={() => {
            setOpen(true)
            setQuery('')
          }}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false)
            if (event.key === 'Enter' && matchingNodes[0]) {
              event.preventDefault()
              choose(matchingNodes[0].id)
            }
          }}
        />
        {value && (
          <button
            type="button"
            aria-label={`Очистить: ${label.toLocaleLowerCase()}`}
            onClick={() => {
              onChange('')
              setQuery('')
              setOpen(false)
            }}
          >
            ×
          </button>
        )}
      </div>
      {open && nodes.length > 0 && (
        <div className="graph-node-picker__options" id={listId} role="listbox" aria-label={`Варианты: ${label.toLocaleLowerCase()}`}>
          {matchingNodes.map((node) => (
            <button
              type="button"
              role="option"
              aria-selected={node.id === value}
              key={node.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(node.id)}
            >
              <span>{node.title}</span>
              <small>{nodeTypeLabels[node.type]}</small>
            </button>
          ))}
          {matchingNodes.length === 0 && <span className="graph-node-picker__empty">Активные узлы не найдены.</span>}
        </div>
      )}
      <small className="graph-node-picker__hint">
        {formatRussianCount(nodes.length, { one: 'активный узел', few: 'активных узла', many: 'активных узлов' })}
      </small>
    </div>
  )
}

function DirectionPicker({
  label,
  value,
  onChange,
}: {
  label: string
  value: GraphDirection
  onChange: (direction: GraphDirection) => void
}) {
  return (
    <label className="graph-select-control">
      <span>{label}</span>
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value as GraphDirection)}>
        <option value="both">В обоих направлениях</option>
        <option value="outgoing">Только исходящие</option>
        <option value="incoming">Только входящие</option>
      </select>
    </label>
  )
}

function NeighborGroup({
  title,
  ids,
  nodesById,
  onOpenNode,
}: {
  title: string
  ids: string[]
  nodesById: Map<string, CanvasNodeData>
  onOpenNode: (id: string) => void
}) {
  return (
    <div className="graph-neighbor-group">
      <h3>
        {title}
        <span>{ids.length}</span>
      </h3>
      {ids.length > 0 ? (
        <ul>
          {ids.slice(0, 8).map((id) => {
            const node = nodesById.get(id)
            return node ? (
              <li key={id}>
                <button onClick={() => onOpenNode(id)}>
                  <span>{node.title}</span>
                  <small>{nodeTypeLabels[node.type]}</small>
                </button>
              </li>
            ) : null
          })}
          {ids.length > 8 && <li className="graph-list-overflow">и ещё {ids.length - 8}</li>}
        </ul>
      ) : (
        <p>Нет</p>
      )}
    </div>
  )
}

function PathResult({
  result,
  nodesById,
  activeEdges,
  onOpenNode,
  onHighlight,
}: {
  result: GraphShortestPathResult
  nodesById: Map<string, CanvasNodeData>
  activeEdges: Workspace['edges']
  onOpenNode: (id: string) => void
  onHighlight: () => void
}) {
  if (!result.found)
    return (
      <div className="graph-result-panel graph-result-panel--empty" role="status">
        В выбранном направлении путь не найден.
      </div>
    )
  const edgeById = new Map(activeEdges.map((edge) => [edge.id, edge]))

  return (
    <div className="graph-result-panel">
      <div className="graph-result-panel__heading">
        <span>
          {formatRussianCount(result.edgeIds.length, { one: 'связь', few: 'связи', many: 'связей' })} · {formatRussianCount(result.nodeIds.length, { one: 'узел', few: 'узла', many: 'узлов' })}
        </span>
        <button className="graph-text-button" onClick={onHighlight}>
          Подсветить путь на холсте
        </button>
      </div>
      <ol className="graph-path-list">
        {result.nodeIds.map((id, index) => {
          const node = nodesById.get(id)
          if (!node) return null
          const edge = result.edgeIds[index] ? edgeById.get(result.edgeIds[index] as string) : undefined
          return (
            <li key={`${id}-${index}`}>
              <button onClick={() => onOpenNode(id)}>
                <span>{node.title}</span>
                <small>{nodeTypeLabels[node.type]}</small>
              </button>
              {edge && (
                <div className="graph-path-list__edge">
                  <ArrowDown size={12} />
                  {getRelationCaption(edge)}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function TraversalResult({
  result,
  nodesById,
  onOpenNode,
  onHighlight,
}: {
  result: GraphTraversalResult
  nodesById: Map<string, CanvasNodeData>
  onOpenNode: (id: string) => void
  onHighlight: () => void
}) {
  const shownIds = result.nodeIds.slice(0, 12)
  return (
    <div className="graph-result-panel">
      <div className="graph-result-panel__heading">
        <span>
          {formatRussianCount(result.nodeIds.length, { one: 'доступный узел', few: 'доступных узла', many: 'доступных узлов' })} ·{' '}
          {result.method === 'breadth-first' ? 'BFS' : 'DFS'}
        </span>
        <button className="graph-text-button" onClick={onHighlight}>
          Подсветить обход на холсте
        </button>
      </div>
      <ol className="graph-traversal-list">
        {shownIds.map((id) => {
          const node = nodesById.get(id)
          return node ? (
            <li key={id}>
              <button onClick={() => onOpenNode(id)}>
                <span>{node.title}</span>
                <small>{nodeTypeLabels[node.type]}</small>
              </button>
            </li>
          ) : null
        })}
      </ol>
      {result.nodeIds.length > shownIds.length && (
        <p className="graph-section-muted">и ещё {result.nodeIds.length - shownIds.length} посещённых узлов</p>
      )}
    </div>
  )
}

function FindingNode({ node, onOpenNode }: { node: CanvasNodeData; onOpenNode: (id: string) => void }) {
  return (
    <button className="graph-finding-node" onClick={() => onOpenNode(node.id)}>
      <span>
        <strong>{node.title}</strong>
        <small>{nodeTypeLabels[node.type]}</small>
      </span>
      <ArrowRight size={14} />
    </button>
  )
}
