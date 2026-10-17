import type { CanvasEdgeData, CanvasNodeData, Workspace } from './model'

const createdAt = new Date().toISOString()

const nodes: CanvasNodeData[] = [
  {
    id: 'neural-canvas', type: 'project', title: 'Нейро-холст',
    description: 'Пространство для идей, знаний и проектов, в которые они превращаются. Связывайте мысли и не теряйте следующий шаг.',
    tags: ['ориентир', 'рабочее пространство'], color: 'rose', favorite: true, properties: [],
    position: { x: 360, y: 245 }, status: 'in-progress', priority: 'high',
    projectStatus: 'in-progress', techStack: ['React', 'TypeScript', 'Zustand', 'React Flow'], repositoryUrl: '', demoUrl: '',
    createdAt, updatedAt: createdAt,
  },
  {
    id: 'systems-thinking', type: 'idea', title: 'Идеи становятся системами',
    description: 'Зафиксируйте мысль, свяжите её с уже известным — так постепенно проявится целостная система.',
    tags: ['принцип', 'мышление'], color: 'violet', favorite: false, properties: [],
    position: { x: 50, y: 85 }, status: 'active', priority: 'medium', createdAt, updatedAt: createdAt,
  },
  {
    id: 'knowledge-graph', type: 'concept', title: 'Граф знаний',
    description: 'Смысл раскрывается в связях. Соединяйте понятия, решения, источники и задачи, на которые они влияют.',
    tags: ['архитектура', 'знания'], color: 'blue', favorite: false, properties: [],
    position: { x: 50, y: 350 }, status: 'active', priority: 'high', createdAt, updatedAt: createdAt,
  },
  {
    id: 'local-first', type: 'concept', title: 'Данные хранятся на устройстве',
    description: 'Рабочее пространство должно быть быстрым и полезным без интернета. Ваши знания остаются у вас.',
    tags: ['без интернета', 'конфиденциальность', 'архитектура'], color: 'blue', favorite: false, properties: [],
    position: { x: 360, y: 20 }, status: 'active', priority: 'high', createdAt, updatedAt: createdAt,
  },
  {
    id: 'developer-flow', type: 'project', title: 'Рабочий процесс разработчика',
    description: 'Соберите сведения о проекте, архитектурные заметки и ближайшие задачи в одном месте.',
    tags: ['процесс', 'разработка'], color: 'rose', favorite: false, properties: [],
    position: { x: 640, y: 85 }, status: 'planned', priority: 'medium',
    projectStatus: 'planning', techStack: ['React', 'TypeScript'], repositoryUrl: '', demoUrl: '',
    createdAt, updatedAt: createdAt,
  },
  {
    id: 'capture-idea', type: 'task', title: 'Зафиксировать идею',
    description: 'Сделайте путь от мысли до записи как можно короче. Добавьте контекст, чтобы позже легко её найти.',
    tags: ['взаимодействие', 'версия 1'], color: 'cyan', favorite: false, properties: [],
    position: { x: 640, y: 350 }, status: 'in-progress', priority: 'high',
    taskStatus: 'in-progress', dueDate: '2026-10-23', projectId: 'neural-canvas', createdAt, updatedAt: createdAt,
  },
  {
    id: 'explore-links', type: 'task', title: 'Исследовать связь',
    description: 'Соедините два узла и сохраните окружающий контекст.',
    tags: ['холст', 'версия 1'], color: 'cyan', favorite: false, properties: [],
    position: { x: 360, y: 470 }, status: 'planned', priority: 'medium',
    taskStatus: 'backlog', dueDate: '2026-10-29', projectId: 'neural-canvas', createdAt, updatedAt: createdAt,
  },
  {
    id: 'learning-log', type: 'note', title: 'Дневник обучения',
    description: 'Записывайте короткие выводы по ходу работы. Что вас удивило? Что изменило взгляд на задачу?',
    tags: ['размышления'], color: 'green', favorite: false, properties: [],
    position: { x: 900, y: 205 }, status: 'active', priority: 'low', createdAt, updatedAt: createdAt,
  },
  {
    id: 'connection-hints', type: 'idea', title: 'Подсказки о связях',
    description: 'Находите близкие идеи по общим словам или смыслу. Подсказки должны быть понятными и необязательными.',
    tags: ['поиск связей', 'ИИ'], color: 'violet', favorite: false, properties: [],
    position: { x: 755, y: 515 }, status: 'planned', priority: 'medium', createdAt, updatedAt: createdAt,
  },
]

const edges: CanvasEdgeData[] = [
  { id: 'e-systems-canvas', sourceId: 'systems-thinking', targetId: 'neural-canvas', relationType: 'supports', label: 'Формирует рабочее пространство', createdAt },
  { id: 'e-graph-canvas', sourceId: 'knowledge-graph', targetId: 'neural-canvas', relationType: 'related_to', label: 'Связывает идеи', createdAt },
  { id: 'e-local-canvas', sourceId: 'local-first', targetId: 'neural-canvas', relationType: 'supports', label: 'Задаёт основу продукта', createdAt },
  { id: 'e-canvas-dev', sourceId: 'neural-canvas', targetId: 'developer-flow', relationType: 'implements', label: 'Помогает в работе над проектом', createdAt },
  { id: 'e-canvas-capture', sourceId: 'neural-canvas', targetId: 'capture-idea', relationType: 'part_of', label: 'Начинается с фиксации идеи', createdAt },
  { id: 'e-canvas-explore', sourceId: 'neural-canvas', targetId: 'explore-links', relationType: 'part_of', label: 'Помогает исследовать связи', createdAt },
  { id: 'e-dev-log', sourceId: 'developer-flow', targetId: 'learning-log', relationType: 'references', label: 'Опирается на размышления', createdAt },
  { id: 'e-hints-graph', sourceId: 'connection-hints', targetId: 'knowledge-graph', relationType: 'derived_from', label: 'Раскрывает структуру', createdAt },
  { id: 'e-hints-canvas', sourceId: 'connection-hints', targetId: 'neural-canvas', relationType: 'implements', label: 'Помогает находить связи', createdAt },
  { id: 'e-capture-systems', sourceId: 'capture-idea', targetId: 'systems-thinking', relationType: 'derived_from', label: 'Начинается с идеи', createdAt },
]

export function createInitialWorkspace(): Workspace {
  return {
    id: 'workspace-main',
    name: 'Продуктовое мышление',
    description: 'Живая карта идей, систем и работы над приложением «Нейро-холст».',
    nodes: nodes.map((node) => ({ ...node, tags: [...node.tags], properties: node.properties.map((property) => ({ ...property })), position: { ...node.position } })),
    edges: edges.map((edge) => ({ ...edge })),
    architectureNotes: [
      {
        id: 'architecture-local-first', title: 'Хранить данные рабочего пространства на устройстве', type: 'technical-decision', projectId: 'neural-canvas',
        content: 'Храните рабочее пространство в IndexedDB, чтобы создавать записи, просматривать их и редактировать граф без интернета. Эта заметка служит только документацией и не запускает код.',
        url: '', code: '', codeLanguage: 'text', tags: ['без интернета', 'хранение данных'], relatedNodeIds: ['local-first'], createdAt, updatedAt: createdAt,
      },
      {
        id: 'architecture-storage-example', title: 'Сохранение записи рабочего пространства', type: 'code', projectId: 'neural-canvas',
        content: 'Пример вызова для локального сохранения данных. Фрагменты кода только отображаются и копируются как текст — они никогда не запускаются.',
        url: '', code: 'await database.workspaces.put(workspace);', codeLanguage: 'typescript', tags: ['локальная база данных'], relatedNodeIds: [], createdAt, updatedAt: createdAt,
      },
    ],
    settings: { defaultView: 'canvas' },
    createdAt,
    updatedAt: createdAt,
  }
}

const legacyWorkspaceCopy = {
  name: ['Product thinking', 'Продуктовое мышление'],
  description: ['A living map for the ideas, systems, and work behind Neural Canvas.', 'Живая карта идей, систем и работы над приложением «Нейро-холст».'],
} as const

const legacyNodeCopy: Record<string, { title: readonly [string, string]; description: readonly [string, string]; tags: readonly [readonly string[], readonly string[]] }> = {
  'neural-canvas': { title: ['Neural Canvas', 'Нейро-холст'], description: ['A home for ideas, knowledge, and the projects they become. Keep the thinking connected and the next step visible.', 'Пространство для идей, знаний и проектов, в которые они превращаются. Связывайте мысли и не теряйте следующий шаг.'], tags: [['north star', 'workspace'], ['ориентир', 'рабочее пространство']] },
  'systems-thinking': { title: ['Ideas become systems', 'Идеи становятся системами'], description: ['Capture a spark, connect it to what you already know, and let a clearer system emerge.', 'Зафиксируйте мысль, свяжите её с уже известным — так постепенно проявится целостная система.'], tags: [['principle', 'thinking'], ['принцип', 'мышление']] },
  'knowledge-graph': { title: ['Knowledge graph', 'Граф знаний'], description: ['Meaning lives in the relationships. Connect concepts, decisions, references, and the work they inform.', 'Смысл раскрывается в связях. Соединяйте понятия, решения, источники и задачи, на которые они влияют.'], tags: [['architecture', 'knowledge'], ['архитектура', 'знания']] },
  'local-first': { title: ['Local-first by default', 'Данные хранятся на устройстве'], description: ['The workspace should feel instant and remain useful offline. Your knowledge belongs with you.', 'Рабочее пространство должно быть быстрым и полезным без интернета. Ваши знания остаются у вас.'], tags: [['offline', 'privacy', 'architecture'], ['без интернета', 'конфиденциальность', 'архитектура']] },
  'developer-flow': { title: ['Developer flow', 'Рабочий процесс разработчика'], description: ['Bring project context, architecture notes, and the next useful task into one focused view.', 'Соберите сведения о проекте, архитектурные заметки и ближайшие задачи в одном месте.'], tags: [['workflow', 'build'], ['процесс', 'разработка']] },
  'capture-idea': { title: ['Capture an idea', 'Зафиксировать идею'], description: ['Make the quickest path from a thought to a useful node. Add enough context to find it later.', 'Сделайте путь от мысли до записи как можно короче. Добавьте контекст, чтобы позже легко её найти.'], tags: [['interaction', 'v1'], ['взаимодействие', 'версия 1']] },
  'explore-links': { title: ['Explore a connection', 'Исследовать связь'], description: ['Draw a relationship between two nodes and keep the surrounding context in view.', 'Соедините два узла и сохраните окружающий контекст.'], tags: [['canvas', 'v1'], ['холст', 'версия 1']] },
  'learning-log': { title: ['Learning log', 'Дневник обучения'], description: ['Collect short reflections from building. What surprised you? What changed the way you see the problem?', 'Записывайте короткие выводы по ходу работы. Что вас удивило? Что изменило взгляд на задачу?'], tags: [['reflection'], ['размышления']] },
  'connection-hints': { title: ['Connection hints', 'Подсказки о связях'], description: ['Surface nearby ideas with shared language or intent. Suggestions should be transparent and easy to ignore.', 'Находите близкие идеи по общим словам или смыслу. Подсказки должны быть понятными и необязательными.'], tags: [['discovery', 'AI'], ['поиск связей', 'ИИ']] },
}

const legacyEdgeLabels: Record<string, readonly [string, string]> = {
  'e-systems-canvas': ['Shapes the workspace', 'Формирует рабочее пространство'],
  'e-graph-canvas': ['Connects the ideas', 'Связывает идеи'],
  'e-local-canvas': ['Grounds the product', 'Задаёт основу продукта'],
  'e-canvas-dev': ['Supports developer flow', 'Помогает в работе над проектом'],
  'e-canvas-capture': ['Starts with capture', 'Начинается с фиксации идеи'],
  'e-canvas-explore': ['Makes space to explore', 'Помогает исследовать связи'],
  'e-dev-log': ['Learns from reflection', 'Опирается на размышления'],
  'e-hints-graph': ['Reveals structure', 'Раскрывает структуру'],
  'e-hints-canvas': ['Adds discovery', 'Помогает находить связи'],
  'e-capture-systems': ['Begins with a spark', 'Начинается с идеи'],
}

const legacyArchitectureCopy: Record<string, { title: readonly [string, string]; content: readonly [string, string]; tags: readonly [readonly string[], readonly string[]] }> = {
  'architecture-local-first': {
    title: ['Keep workspace data local-first', 'Хранить данные рабочего пространства на устройстве'],
    content: ['Persist the workspace in IndexedDB so capture, browsing, and graph editing continue to work offline. This note is documentation only; it does not trigger any code.', 'Храните рабочее пространство в IndexedDB, чтобы создавать записи, просматривать их и редактировать граф без интернета. Эта заметка служит только документацией и не запускает код.'],
    tags: [['offline', 'storage'], ['без интернета', 'хранение данных']],
  },
  'architecture-storage-example': {
    title: ['Persist a workspace record', 'Сохранение записи рабочего пространства'],
    content: ['A small illustrative snippet showing the local persistence call. Code blocks are displayed and copied as text; they are never executed.', 'Пример вызова для локального сохранения данных. Фрагменты кода только отображаются и копируются как текст — они никогда не запускаются.'],
    tags: [['indexeddb'], ['локальная база данных']],
  },
}

/** Translate only unchanged built-in English starter copy; user-authored workspace text is preserved. */
export function localizeLegacyStarterWorkspace(workspace: Workspace): { workspace: Workspace; changed: boolean } {
  if (workspace.id !== 'workspace-main') return { workspace, changed: false }
  let changed = false
  const translateString = (value: string, pair: readonly [string, string]) => {
    if (value !== pair[0]) return value
    changed = true
    return pair[1]
  }
  const translateTags = (tags: string[], pair: readonly [readonly string[], readonly string[]]) => {
    if (tags.length !== pair[0].length || tags.some((tag, index) => tag !== pair[0][index])) return tags
    changed = true
    return [...pair[1]]
  }

  const nodes = workspace.nodes.map((node) => {
    const copy = legacyNodeCopy[node.id]
    if (!copy) return node
    return {
      ...node,
      title: translateString(node.title, copy.title),
      description: translateString(node.description, copy.description),
      tags: translateTags(node.tags, copy.tags),
    }
  })
  const edges = workspace.edges.map((edge) => {
    const label = legacyEdgeLabels[edge.id]
    return label ? { ...edge, label: translateString(edge.label, label) } : edge
  })
  const architectureNotes = workspace.architectureNotes.map((note) => {
    const copy = legacyArchitectureCopy[note.id]
    if (!copy) return note
    return {
      ...note,
      title: translateString(note.title, copy.title),
      content: translateString(note.content, copy.content),
      tags: translateTags(note.tags, copy.tags),
    }
  })

  return {
    workspace: {
      ...workspace,
      name: translateString(workspace.name, legacyWorkspaceCopy.name),
      description: translateString(workspace.description, legacyWorkspaceCopy.description),
      nodes,
      edges,
      architectureNotes,
    },
    changed,
  }
}
