import { executeGraphQuery, type GraphQuery, type GraphSnapshot } from './graph-intelligence'

export type GraphWorkerRequest = {
  requestId: number
  graph: GraphSnapshot
  query: GraphQuery
}

export type GraphWorkerResponse =
  { requestId: number; result: ReturnType<typeof executeGraphQuery> } | { requestId: number; error: string }

type WorkerScope = {
  addEventListener: (type: 'message', listener: (event: MessageEvent<GraphWorkerRequest>) => void) => void
  postMessage: (message: GraphWorkerResponse) => void
}

const workerScope = self as unknown as WorkerScope

workerScope.addEventListener('message', (event) => {
  const { requestId, graph, query } = event.data
  try {
    workerScope.postMessage({
      requestId,
      result: executeGraphQuery(graph, query),
    })
  } catch (error) {
    workerScope.postMessage({
      requestId,
      error: error instanceof Error && /[А-Яа-яЁё]/u.test(error.message) ? error.message : 'Не удалось завершить анализ графа.',
    })
  }
})
