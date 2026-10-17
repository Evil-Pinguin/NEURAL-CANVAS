import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Background, BackgroundVariant, Controls, MarkerType, MiniMap, ReactFlow, ReactFlowProvider, SelectionMode, useReactFlow, type Connection, type Edge, type EdgeChange, type XYPosition } from '@xyflow/react'
import { Check, ChevronDown, ChevronRight, CirclePlus, Crosshair, Focus, Menu, MousePointer2, Network, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import type { CanvasEdgeData, CanvasNodeData, NodeKind, Workspace, WorkspaceFilters } from '../domain/model'
import { defaultNodeColor, getRelationCaption, kindLabels, nodeColorHex, nodeKinds, type RelationType } from '../domain/model'
import { formatRussianCount, flowAriaLabelConfig } from '../utils/locale'
import { useWorkspaceStore } from '../store/workspace-store'
import { findClearPosition } from '../utils/layout'
import { matchesNodeFilters, matchesNodeQuery } from '../utils/search'
import { handleMenuKeyDown } from '../hooks/useDialogAccessibility'
import { useSynchronizedFlowNodes } from '../hooks/useSynchronizedFlowNodes'
import ConnectionLabelDialog from './ConnectionLabelDialog'
import MindNode, { type FlowNode } from './MindNode'

const nodeTypes = { mindNode: MindNode }
type FlowEdge = Edge
type SelectionChange = (nodeIds: string[], edgeIds: string[]) => void
type ContextMenuKind = 'pane' | 'node' | 'edge'
type CanvasContextMenu = {
  kind: ContextMenuKind
  x: number
  y: number
  flowPosition: XYPosition
  targetId?: string
}
type CanvasWorkspaceProps = {
  workspace: Workspace
  query: string
  filters: WorkspaceFilters
  selectedNodeIds: string[]
  selectedEdgeIds: string[]
  fitRequest: number
  inspectorCollapsed: boolean
  onToggleInspector: () => void
  onOpenInspector: () => void
  onSelectionChange: SelectionChange
  onPrimaryNodeChange: (id: string | null) => void
  onResetFilters: () => void
}

const edgeStyle = { stroke: 'rgba(136, 151, 205, 0.48)', strokeWidth: 1.35 }
const relationEdgeColors: Record<RelationType, string> = {
  related_to: 'rgba(148, 161, 214, 0.62)',
  depends_on: 'rgba(223, 186, 110, 0.78)',
  part_of: 'rgba(165, 140, 247, 0.74)',
  implements: 'rgba(114, 212, 226, 0.76)',
  contradicts: 'rgba(217, 151, 188, 0.82)',
  supports: 'rgba(129, 214, 170, 0.78)',
  references: 'rgba(157, 167, 188, 0.72)',
  derived_from: 'rgba(123, 162, 235, 0.76)',
  blocks: 'rgba(226, 122, 116, 0.82)',
  custom: 'rgba(223, 186, 110, 0.72)',
}
const selectedEdgeStyle = { stroke: 'rgba(191, 169, 255, 0.96)', strokeWidth: 2.5, filter: 'drop-shadow(0 0 5px rgba(164, 137, 255, .55))' }
const labelBgStyle = { fill: 'rgba(17, 21, 32, 0.88)', fillOpacity: 0.96, stroke: 'rgba(159, 171, 213, 0.12)', strokeWidth: 1 }
const canvasFitViewOptions = { padding: 0.18, minZoom: 0.22, maxZoom: 1.05, duration: 420 }
const canvasMultiSelectionKeys = ['Meta', 'Control']
const canvasDeleteKeys = ['Backspace', 'Delete']
const canvasDefaultEdgeOptions = { type: 'smoothstep', style: edgeStyle }
const canvasProOptions = { hideAttribution: true }
const canvasMiniMapNodeColor = (node: { data: unknown }) => {
  const data = node.data as CanvasNodeData
  return nodeColorHex[data.color ?? defaultNodeColor[data.type]]
}

type FlowPositionSnapshot = { id: string; position: XYPosition }

export default function CanvasWorkspace(props: CanvasWorkspaceProps) {
  return (
    <ReactFlowProvider>
      <CanvasWorkspaceInner {...props} />
    </ReactFlowProvider>
  )
}

function CanvasWorkspaceInner({
  workspace,
  query,
  filters,
  selectedNodeIds,
  selectedEdgeIds,
  fitRequest,
  inspectorCollapsed,
  onToggleInspector,
  onOpenInspector,
  onSelectionChange,
  onPrimaryNodeChange,
  onResetFilters,
}: CanvasWorkspaceProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const createMenuRef = useRef<HTMLDivElement>(null)
  const createMenuTriggerRef = useRef<HTMLButtonElement>(null)
  const contextMenuTriggerRef = useRef<HTMLElement | null>(null)
  const lastFitRequestRef = useRef(0)
  const [createMenuOpen, setCreateMenuOpen] = useState(false)
  const [selectionModeEnabled, setSelectionModeEnabled] = useState(false)
  const [contextMenu, setContextMenu] = useState<CanvasContextMenu | null>(null)
  const [editingEdge, setEditingEdge] = useState<CanvasEdgeData | null>(null)
  const addNode = useWorkspaceStore((state) => state.addNode)
  const updateNode = useWorkspaceStore((state) => state.updateNode)
  const syncFlowNodes = useWorkspaceStore((state) => state.syncFlowNodes)
  const syncFlowEdges = useWorkspaceStore((state) => state.syncFlowEdges)
  const addEdge = useWorkspaceStore((state) => state.addEdge)
  const deleteEdge = useWorkspaceStore((state) => state.deleteEdge)
  const trashNode = useWorkspaceStore((state) => state.trashNode)
  const { fitView, screenToFlowPosition, getNodesBounds, getZoom, setCenter } = useReactFlow<FlowNode, FlowEdge>()
  const normalizedQuery = query.trim().toLowerCase()
  const liveNodes = useMemo(() => workspace.nodes.filter((node) => !node.deletedAt), [workspace.nodes])
  const visibleNodes = useMemo(() => liveNodes.filter((node) => matchesNodeFilters(node, filters)), [liveNodes, filters])
  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes])
  const selectedNodeSet = useMemo(() => new Set(selectedNodeIds.filter((id) => visibleNodeIds.has(id))), [selectedNodeIds, visibleNodeIds])
  const relatedNodeIds = useMemo(() => {
    const related = new Set<string>()
    if (selectedNodeSet.size === 0) return related
    workspace.edges.forEach((edge) => {
      if (selectedNodeSet.has(edge.sourceId) && visibleNodeIds.has(edge.targetId)) related.add(edge.targetId)
      if (selectedNodeSet.has(edge.targetId) && visibleNodeIds.has(edge.sourceId)) related.add(edge.sourceId)
    })
    selectedNodeSet.forEach((id) => related.delete(id))
    return related
  }, [selectedNodeSet, visibleNodeIds, workspace.edges])
  const handleIdeaFrameResize = useCallback((id: string, frameSize: { width: number; height: number }) => {
    const currentNode = useWorkspaceStore.getState().workspace.nodes.find((node) => node.id === id)
    if (currentNode?.type !== 'idea') return
    updateNode(id, { frameSize })
  }, [updateNode])

  const flowNodes = useMemo<FlowNode[]>(() => visibleNodes.map((node) => {
    const selected = selectedNodeSet.has(node.id)
    const related = relatedNodeIds.has(node.id)
    return {
      id: node.id,
      type: 'mindNode',
      position: node.position,
      data: {
        ...node,
        dimmed: Boolean(normalizedQuery) && !matchesNodeQuery(node, normalizedQuery) && !selected && !related,
        related,
        unrelated: selectedNodeSet.size > 0 && !selected && !related,
        ...(node.type === 'idea' ? { onFrameResize: handleIdeaFrameResize } : {}),
      },
      selected,
    }
  }), [visibleNodes, normalizedQuery, selectedNodeSet, relatedNodeIds, handleIdeaFrameResize])

  const flowEdges = useMemo<FlowEdge[]>(() => workspace.edges
    .filter((edge) => visibleNodeIds.has(edge.sourceId) && visibleNodeIds.has(edge.targetId))
    .map((edge) => {
      const selected = selectedEdgeIds.includes(edge.id)
      return {
        id: edge.id,
        source: edge.sourceId,
        target: edge.targetId,
        label: getRelationCaption(edge),
        type: 'smoothstep',
        selected,
        style: selected ? selectedEdgeStyle : {
          stroke: relationEdgeColors[edge.relationType],
          strokeWidth: edge.relationType === 'custom' ? 1.5 : 1.35,
          ...(['custom', 'contradicts'].includes(edge.relationType) ? { strokeDasharray: '5 4' } : {}),
        },
        labelStyle: { fill: selected ? '#e1d8ff' : '#adb6ca', fontSize: 10, fontFamily: 'DM Sans, sans-serif' },
        labelBgStyle,
        labelBgPadding: [6, 3] as [number, number],
        labelBgBorderRadius: 5,
        markerEnd: { type: MarkerType.ArrowClosed, color: selected ? 'rgba(191, 169, 255, .96)' : relationEdgeColors[edge.relationType], width: 14, height: 14 },
        interactionWidth: 18,
      }
    }), [workspace.edges, visibleNodeIds, selectedEdgeIds])
  const visibleEdgeIds = useMemo(() => new Set(flowEdges.map((edge) => edge.id)), [flowEdges])

  useEffect(() => {
    if (fitRequest === 0 || fitRequest === lastFitRequestRef.current) return
    lastFitRequestRef.current = fitRequest
    void fitView({ padding: 0.18, duration: 350 })
  }, [fitRequest, fitView])

  useEffect(() => {
    const validNodeIds = selectedNodeIds.filter((id) => visibleNodeIds.has(id))
    const validEdgeIds = selectedEdgeIds.filter((id) => visibleEdgeIds.has(id))
    if (validNodeIds.length !== selectedNodeIds.length || validEdgeIds.length !== selectedEdgeIds.length) {
      onSelectionChange(validNodeIds, validEdgeIds)
    }
  }, [selectedNodeIds, selectedEdgeIds, visibleNodeIds, visibleEdgeIds, onSelectionChange])

  useEffect(() => {
    contextMenuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
  }, [contextMenu])

  useEffect(() => {
    if (createMenuOpen) createMenuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
  }, [createMenuOpen])

  const onNodePositionsSettled = useCallback((positions: { id: string; position: XYPosition }[], removedIds: string[]) => {
    if (positions.length || removedIds.length) syncFlowNodes(positions, removedIds)
  }, [syncFlowNodes])

  const onEdgesChange = useCallback((changes: EdgeChange<FlowEdge>[]) => {
    const removedIds = changes.flatMap((change) => change.type === 'remove' ? [change.id] : [])
    if (removedIds.length) syncFlowEdges(removedIds)
  }, [syncFlowEdges])

  const onConnect = useCallback((connection: Connection) => {
    if (connection.source && connection.target) addEdge(connection.source, connection.target)
  }, [addEdge])

  const handleSelectionChange = useCallback(({ nodes, edges }: { nodes: FlowNode[]; edges: FlowEdge[] }) => {
    onSelectionChange(nodes.map((node) => node.id), edges.map((edge) => edge.id))
  }, [onSelectionChange])

  const onBeforeDelete = useCallback(async ({ nodes, edges }: { nodes: FlowNode[]; edges: FlowEdge[] }) => {
    const trashedIds = new Set(nodes.map((node) => node.id))
    nodes.forEach((node) => trashNode(node.id))
    edges.filter((edge) => !trashedIds.has(edge.source) && !trashedIds.has(edge.target)).forEach((edge) => deleteEdge(edge.id))
    onSelectionChange([], [])
    onPrimaryNodeChange(null)
    setContextMenu(null)
    return false
  }, [deleteEdge, onPrimaryNodeChange, onSelectionChange, trashNode])

  const createAt = useCallback((kind: NodeKind, center: XYPosition) => {
    const position = findClearPosition(liveNodes, center, kind)
    const node = addNode(kind, position)
    onSelectionChange([node.id], [])
    onPrimaryNodeChange(node.id)
    onOpenInspector()
    onResetFilters()
    setCreateMenuOpen(false)
    setContextMenu(null)
    return node
  }, [addNode, liveNodes, onOpenInspector, onPrimaryNodeChange, onResetFilters, onSelectionChange])

  const closeCreateMenu = (restoreFocus = false) => {
    setCreateMenuOpen(false)
    if (restoreFocus) queueMicrotask(() => createMenuTriggerRef.current?.focus())
  }

  const handleCreate = (kind: NodeKind) => {
    const bounds = stageRef.current?.getBoundingClientRect()
    const screenPoint = bounds
      ? { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }
      : { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    createAt(kind, screenToFlowPosition(screenPoint))
  }

  const handlePaneClick = useCallback(() => {
    setContextMenu(null)
    onPrimaryNodeChange(null)
  }, [onPrimaryNodeChange])

  const handleStageDoubleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target
    if (!(target instanceof Element) || !target.closest('.react-flow__pane') || target.closest('.react-flow__node')) return
    createAt('idea', screenToFlowPosition({ x: event.clientX, y: event.clientY }))
  }

  const openContextMenu = useCallback((event: ReactMouseEvent | MouseEvent, kind: ContextMenuKind, targetId?: string) => {
    event.preventDefault()
    event.stopPropagation()
    const bounds = stageRef.current?.getBoundingClientRect()
    if (!bounds) return
    const width = 228
    const estimatedHeight = kind === 'pane' ? 270 : kind === 'node' ? 154 : 92
    const x = Math.max(8, Math.min(event.clientX - bounds.left, bounds.width - width - 8))
    const y = Math.max(8, Math.min(event.clientY - bounds.top, bounds.height - estimatedHeight - 8))
    contextMenuTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setCreateMenuOpen(false)
    if (kind === 'node' && targetId) {
      onPrimaryNodeChange(targetId)
      onSelectionChange([targetId], [])
    } else if (kind === 'edge' && targetId) {
      onPrimaryNodeChange(null)
      onSelectionChange([], [targetId])
    } else {
      onPrimaryNodeChange(null)
      onSelectionChange([], [])
    }
    setContextMenu({ kind, x, y, flowPosition: screenToFlowPosition({ x: event.clientX, y: event.clientY }), ...(targetId ? { targetId } : {}) })
  }, [onPrimaryNodeChange, onSelectionChange, screenToFlowPosition])

  const handleSelectConnected = (nodeId: string) => {
    const relatedIds = workspace.edges.flatMap((edge) => {
      if (edge.sourceId === nodeId && visibleNodeIds.has(edge.targetId)) return [edge.targetId]
      if (edge.targetId === nodeId && visibleNodeIds.has(edge.sourceId)) return [edge.sourceId]
      return []
    })
    onPrimaryNodeChange(nodeId)
    onSelectionChange([...new Set([nodeId, ...relatedIds])], [])
    setContextMenu(null)
  }

  const handleContextCreate = (kind: NodeKind) => {
    if (contextMenu) createAt(kind, contextMenu.flowPosition)
  }

  const handleContextTrash = () => {
    if (!contextMenu?.targetId) return
    trashNode(contextMenu.targetId)
    onSelectionChange([], [])
    onPrimaryNodeChange(null)
    setContextMenu(null)
  }

  const handleContextDeleteEdge = () => {
    if (!contextMenu?.targetId) return
    deleteEdge(contextMenu.targetId)
    onSelectionChange([], [])
    setContextMenu(null)
  }

  const handleContextRenameEdge = () => {
    if (!contextMenu?.targetId) return
    const edge = workspace.edges.find((item) => item.id === contextMenu.targetId)
    setContextMenu(null)
    if (edge) setEditingEdge(edge)
  }

  const closeConnectionLabelDialog = () => {
    const edgeId = editingEdge?.id
    setEditingEdge(null)
    if (!edgeId) return
    window.setTimeout(() => {
      const edgeElement = Array.from(document.querySelectorAll<SVGGElement>('.react-flow__edge[data-id]'))
        .find((element) => element.getAttribute('data-id') === edgeId)
      edgeElement?.focus({ preventScroll: true })
    }, 0)
  }

  const handleNodeClick = useCallback((_event: ReactMouseEvent, node: FlowNode) => {
    setContextMenu(null)
    onPrimaryNodeChange(node.id)
  }, [onPrimaryNodeChange])

  const handleEdgeClick = useCallback(() => {
    setContextMenu(null)
    onPrimaryNodeChange(null)
  }, [onPrimaryNodeChange])

  const centerGraph = useCallback(() => {
    const selectedVisibleIds = selectedNodeIds.filter((id) => visibleNodeIds.has(id))
    const targetIds = selectedVisibleIds.length ? selectedVisibleIds : visibleNodes.map((node) => node.id)
    if (targetIds.length === 0) {
      void fitView({ padding: 0.2, duration: 350 })
      return
    }
    const bounds = getNodesBounds(targetIds)
    void setCenter(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, { zoom: getZoom(), duration: 350 })
  }, [fitView, getNodesBounds, getZoom, selectedNodeIds, setCenter, visibleNodeIds, visibleNodes])

  return (
    <div className="canvas-view">
      <div className="canvas-header">
        <div className="canvas-header__heading">
          <div className="breadcrumb"><span>РАБОЧЕЕ ПРОСТРАНСТВО</span><ChevronRight size={13} /><span>ХОЛСТ</span></div>
          <div className="canvas-title-row"><h1>{workspace.name}</h1><span className="canvas-live-tag"><i /> ГРАФ ОБНОВЛЯЕТСЯ</span></div>
          <p>{workspace.description}</p>
        </div>
        <div className="canvas-header__actions">
          <div className="canvas-counts"><span><i className="count-dot count-dot--nodes" />{formatRussianCount(visibleNodes.length, { one: 'узел', few: 'узла', many: 'узлов' })}</span><span className="count-divider" /><span><i className="count-dot count-dot--edges" />{formatRussianCount(flowEdges.length, { one: 'связь', few: 'связи', many: 'связей' })}</span></div>
          <div className="add-node-control">
            <button className="button-primary" onClick={() => handleCreate('idea')}><CirclePlus size={15} /><span>Новый объект</span></button>
            <button
              ref={createMenuTriggerRef}
              className="button-primary button-primary__chevron"
              aria-label="Выбрать тип объекта"
              aria-expanded={createMenuOpen}
              aria-controls="canvas-node-create-menu"
              aria-haspopup="menu"
              title="Выбрать тип объекта"
              onClick={() => createMenuOpen ? closeCreateMenu(true) : setCreateMenuOpen(true)}
            ><ChevronDown size={14} /></button>
            {createMenuOpen && <>
              <button className="menu-dismiss" aria-label="Закрыть меню объектов" onClick={() => closeCreateMenu(true)} />
              <div
                ref={createMenuRef}
                id="canvas-node-create-menu"
                className="node-create-menu"
                role="menu"
                aria-label="Создать объект"
                onKeyDown={(event) => handleMenuKeyDown(event, () => closeCreateMenu(true))}
              >
                <span className="menu-eyebrow">СОЗДАТЬ ОБЪЕКТ</span>
                {nodeKinds.map((kind) => (
                  <button role="menuitem" tabIndex={-1} key={kind} onClick={() => handleCreate(kind)}><KindMenuIcon kind={kind} />{kindLabels[kind]}<Plus size={13} /></button>
                ))}
                <span className="menu-note">Связь появится только после того, как вы соедините объекты.</span>
              </div>
            </>}
          </div>
        </div>
      </div>

      <div className="canvas-stage" ref={stageRef} onDoubleClick={handleStageDoubleClick}>
        <div className="canvas-corner-glow canvas-corner-glow--one" aria-hidden="true" />
        <div className="canvas-corner-glow canvas-corner-glow--two" aria-hidden="true" />
        <div className="canvas-stage__top-note"><span className="stage-note-icon"><Network size={13} /></span><span>Граф знаний</span><span className="stage-note-dot" /> <span>Перетаскивайте объекты · соединяйте их маркеры</span></div>
        <CanvasFlowSurface
          nodes={flowNodes}
          edges={flowEdges}
          selectionModeEnabled={selectionModeEnabled}
          onNodePositionsSettled={onNodePositionsSettled}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onBeforeDelete={onBeforeDelete}
          onSelectionChange={handleSelectionChange}
          onNodeClick={handleNodeClick}
          onNodeContextMenu={(event, node) => openContextMenu(event, 'node', node.id)}
          onEdgeClick={handleEdgeClick}
          onEdgeContextMenu={(event, edge) => openContextMenu(event, 'edge', edge.id)}
          onPaneClick={handlePaneClick}
          onPaneContextMenu={(event) => openContextMenu(event, 'pane')}
        />

        <div className="canvas-stage__bottom-note"><span>Двойной щелчок — создать · перетаскивание — переместить холст · Shift + перетаскивание — выделить · прокрутка — масштаб</span></div>
        {normalizedQuery && <div className="search-result-pill"><Sparkles size={13} /> Поиск подсвечивает совпавшие объекты</div>}
        {selectedNodeIds.length > 1 && <div className="canvas-selection-pill" role="status"><Check size={12} /> {formatRussianCount(selectedNodeIds.length, { one: 'объект выбран', few: 'объекта выбраны', many: 'объектов выбрано' })} · перетащите, чтобы переместить вместе · клавиша Delete — в корзину</div>}
        <div className="canvas-view-actions">
          <button className={`canvas-selection-mode${selectionModeEnabled ? ' is-active' : ''}`} title="Выделить несколько объектов рамкой" aria-label={selectionModeEnabled ? 'Выйти из режима выделения' : 'Включить режим выделения'} aria-pressed={selectionModeEnabled} onClick={() => setSelectionModeEnabled((enabled) => !enabled)}><MousePointer2 size={15} /><span>Выделить</span></button>
          <button className="canvas-center-button" title="Показать по центру граф или выбранную группу" aria-label="Центрировать граф" onClick={centerGraph}><Crosshair size={15} /><span>По центру</span></button>
          <button className="canvas-focus-button" title="Вместить все видимые объекты в область просмотра" aria-label="Вместить граф в область просмотра" onClick={() => fitView({ padding: 0.18, minZoom: 0.16, maxZoom: 1.05, duration: 420 })}><Focus size={15} /><span>Вместить</span></button>
          <button
            className={`canvas-inspector-toggle${inspectorCollapsed ? '' : ' is-active'}`}
            type="button"
            aria-label={inspectorCollapsed ? 'Показать панель сведений' : 'Скрыть панель сведений'}
            aria-expanded={!inspectorCollapsed}
            title={inspectorCollapsed ? 'Показать данные объекта' : 'Скрыть данные объекта'}
            onClick={onToggleInspector}
          ><Menu size={15} aria-hidden="true" /></button>
        </div>

        {contextMenu && <>
          <button className="canvas-context-dismiss" aria-label="Закрыть контекстное меню холста" onClick={() => setContextMenu(null)} />
          <div
            ref={contextMenuRef}
            className="canvas-context-menu"
            role="menu"
            aria-label="Контекстное меню холста"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onKeyDown={(event) => handleMenuKeyDown(event, () => {
              setContextMenu(null)
              queueMicrotask(() => contextMenuTriggerRef.current?.focus())
            })}
          >
            <span className="canvas-context-menu__eyebrow">{contextMenu.kind === 'pane' ? 'СОЗДАТЬ В ЭТОМ МЕСТЕ' : contextMenu.kind === 'node' ? 'ДЕЙСТВИЯ С ОБЪЕКТОМ' : 'ДЕЙСТВИЯ СО СВЯЗЬЮ'}</span>
            {contextMenu.kind === 'pane' && <>
              {nodeKinds.map((kind) => <button role="menuitem" tabIndex={-1} key={kind} onClick={() => handleContextCreate(kind)}><KindMenuIcon kind={kind} />{kindLabels[kind]} здесь<Plus size={13} /></button>)}
              <span className="canvas-context-menu__note">Связь появится только после явного соединения объектов.</span>
            </>}
            {contextMenu.kind === 'node' && contextMenu.targetId && <>
              <button role="menuitem" tabIndex={-1} onClick={() => handleSelectConnected(contextMenu.targetId!)}><Network size={14} />Выбрать связанные объекты<Check size={12} /></button>
              <button role="menuitem" tabIndex={-1} onClick={() => handleContextCreate('idea')}><CirclePlus size={14} />Создать идею рядом<Plus size={13} /></button>
              <button role="menuitem" tabIndex={-1} className="is-danger" onClick={handleContextTrash}><Trash2 size={14} />Переместить в корзину</button>
            </>}
            {contextMenu.kind === 'edge' && <>
              <button role="menuitem" tabIndex={-1} onClick={handleContextRenameEdge}><Pencil size={14} />Переименовать связь</button>
              <button role="menuitem" tabIndex={-1} className="is-danger" onClick={handleContextDeleteEdge}><Trash2 size={14} />Удалить связь</button>
            </>}
          </div>
        </>}
        {editingEdge && <ConnectionLabelDialog edge={editingEdge} onClose={closeConnectionLabelDialog} />}
      </div>
    </div>
  )
}


type CanvasFlowSurfaceProps = {
  nodes: FlowNode[]
  edges: FlowEdge[]
  selectionModeEnabled: boolean
  onNodePositionsSettled: (positions: FlowPositionSnapshot[], removedIds: string[]) => void
  onEdgesChange: (changes: EdgeChange<FlowEdge>[]) => void
  onConnect: (connection: Connection) => void
  onBeforeDelete: (elements: { nodes: FlowNode[]; edges: FlowEdge[] }) => Promise<boolean>
  onSelectionChange: (selection: { nodes: FlowNode[]; edges: FlowEdge[] }) => void
  onNodeClick: (event: ReactMouseEvent, node: FlowNode) => void
  onNodeContextMenu: (event: ReactMouseEvent | MouseEvent, node: FlowNode) => void
  onEdgeClick: () => void
  onEdgeContextMenu: (event: ReactMouseEvent | MouseEvent, edge: FlowEdge) => void
  onPaneClick: () => void
  onPaneContextMenu: (event: ReactMouseEvent | MouseEvent) => void
}

const CanvasFlowSurface = memo(function CanvasFlowSurface({
  nodes,
  edges,
  selectionModeEnabled,
  onNodePositionsSettled,
  onEdgesChange,
  onConnect,
  onBeforeDelete,
  onSelectionChange,
  onNodeClick,
  onNodeContextMenu,
  onEdgeClick,
  onEdgeContextMenu,
  onPaneClick,
  onPaneContextMenu,
}: CanvasFlowSurfaceProps) {
  const [isDragging, setIsDragging] = useState(false)
  const handleNodesChange = useSynchronizedFlowNodes(nodes, onNodePositionsSettled)

  const handleNodeDragStart = useCallback(() => setIsDragging(true), [])
  const handleNodeDragStop = useCallback(() => setIsDragging(false), [])

  return (
    <ReactFlow<FlowNode, FlowEdge>
      defaultNodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={handleNodesChange}
      onNodeDragStart={handleNodeDragStart}
      onNodeDragStop={handleNodeDragStop}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onBeforeDelete={onBeforeDelete}
      onSelectionChange={onSelectionChange}
      onNodeClick={onNodeClick}
      onNodeContextMenu={onNodeContextMenu}
      onEdgeClick={onEdgeClick}
      onEdgeContextMenu={onEdgeContextMenu}
      onPaneClick={onPaneClick}
      onPaneContextMenu={onPaneContextMenu}
      fitView
      ariaLabelConfig={flowAriaLabelConfig}
      fitViewOptions={canvasFitViewOptions}
      minZoom={0.16}
      maxZoom={2}
      selectionKeyCode="Shift"
      selectionOnDrag={selectionModeEnabled}
      selectionMode={SelectionMode.Partial}
      multiSelectionKeyCode={canvasMultiSelectionKeys}
      defaultEdgeOptions={canvasDefaultEdgeOptions}
      onlyRenderVisibleElements
      proOptions={canvasProOptions}
      nodesConnectable
      nodesDraggable
      elementsSelectable
      panOnDrag={!selectionModeEnabled}
      zoomOnDoubleClick={false}
      deleteKeyCode={canvasDeleteKeys}
      className={`neural-flow${isDragging ? ' is-dragging' : ''}`}
      aria-label="Холст графа знаний"
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1.15} color="rgba(126, 139, 176, .17)" />
      <Controls position="bottom-left" showInteractive={false} aria-label="Управление графом" />
      <MiniMap
        position="bottom-right"
        ariaLabel="Мини-карта графа"
        pannable
        zoomable
        nodeStrokeWidth={2}
        nodeColor={canvasMiniMapNodeColor}
        maskColor="rgba(7, 9, 15, 0.68)"
      />
    </ReactFlow>
  )
})

function KindMenuIcon({ kind }: { kind: NodeKind }) {
  const icons: Record<NodeKind, string> = {
    idea: '✦', concept: '⌘', knowledge: '◈', project: '▱', task: '□',
    note: '≡', resource: '↗', question: '?', hypothesis: '∴', decision: '◆',
  }
  return <span aria-hidden="true" className={`node-menu-icon node-menu-icon--${kind}`}>{icons[kind]}</span>
}
