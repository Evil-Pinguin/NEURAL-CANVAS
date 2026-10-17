import type { Workspace } from '../domain/model'
import { createGraphSnapshot, executeGraphQuery, type GraphQuery, type GraphQueryResult } from './graph-intelligence'
import type { GraphWorkerRequest, GraphWorkerResponse } from './graph-intelligence.worker'

export const GRAPH_WORKER_NODE_THRESHOLD = 300
export const GRAPH_WORKER_EDGE_THRESHOLD = 900

let nextRequestId = 1

type WorkspaceGraphData = Pick<Workspace, 'nodes' | 'edges'>

/** Run lightweight queries asynchronously; move larger bounded workspaces off the UI thread. */
export function runGraphQuery(
  workspace: WorkspaceGraphData,
  query: GraphQuery,
  signal?: AbortSignal,
): Promise<GraphQueryResult> {
  if (signal?.aborted) return Promise.reject(createAbortError())
  const graph = createGraphSnapshot(workspace)
  const shouldUseWorker =
    graph.nodes.length >= GRAPH_WORKER_NODE_THRESHOLD || graph.edges.length >= GRAPH_WORKER_EDGE_THRESHOLD

  if (shouldUseWorker) {
    if (typeof Worker === 'undefined') {
      return Promise.reject(
        new Error(
          'В этом браузере недоступен фоновый анализ графа. Данные не анализировались в интерфейсе, чтобы не блокировать его работу.',
        ),
      )
    }
    return runInWorker(graph, query, signal)
  }

  return runOnMainThread(graph, query, signal)
}

function runInWorker(
  graph: ReturnType<typeof createGraphSnapshot>,
  query: GraphQuery,
  signal?: AbortSignal,
): Promise<GraphQueryResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./graph-intelligence.worker.ts', import.meta.url), { type: 'module' })
    const request: GraphWorkerRequest = {
      requestId: nextRequestId++,
      graph,
      query,
    }
    let settled = false

    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      signal?.removeEventListener('abort', onAbort)
      worker.terminate()
      callback()
    }
    const onAbort = () => finish(() => reject(createAbortError()))

    worker.addEventListener('message', (event: MessageEvent<GraphWorkerResponse>) => {
      const response = event.data
      if (response.requestId !== request.requestId) return
      if ('error' in response) {
        finish(() => reject(new Error(response.error)))
      } else {
        finish(() => resolve(response.result))
      }
    })
    worker.addEventListener('error', (event: ErrorEvent) => {
      event.preventDefault()
      finish(() => reject(new Error('Не удалось запустить фоновый анализ графа. Повторите попытку.')))
    })
    signal?.addEventListener('abort', onAbort, { once: true })

    if (signal?.aborted) {
      onAbort()
      return
    }

    try {
      worker.postMessage(request)
    } catch {
      finish(() => reject(new Error('Не удалось передать локальный граф для фонового анализа.')))
    }
  })
}

function runOnMainThread(
  graph: ReturnType<typeof createGraphSnapshot>,
  query: GraphQuery,
  signal?: AbortSignal,
): Promise<GraphQueryResult> {
  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      if (signal?.aborted) {
        reject(createAbortError())
        return
      }
      try {
        resolve(executeGraphQuery(graph, query))
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Не удалось завершить анализ графа.'))
      }
    }, 0)
    const onAbort = () => {
      globalThis.clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      reject(createAbortError())
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function createAbortError(): Error {
  const error = new Error('Анализ графа отменён.')
  error.name = 'AbortError'
  return error
}
