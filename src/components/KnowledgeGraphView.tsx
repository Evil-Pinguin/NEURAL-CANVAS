import { useCallback, useMemo, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type EdgeChange,
} from '@xyflow/react'
import type { CanvasNodeData, Workspace } from '../domain/model'
import { getRelationCaption, knowledgeNodeTypes, nodeColorHex, type RelationType } from '../domain/model'
import { useWorkspaceStore } from '../store/workspace-store'
import { useSynchronizedFlowNodes } from '../hooks/useSynchronizedFlowNodes'
import { flowAriaLabelConfig } from '../utils/locale'
import MindNode, { type FlowNode } from './MindNode'

type KnowledgeGraphViewProps = {
  workspace: Workspace
  nodeIds: string[]
  selectedNodeId: string | null
  onSelectNode: (id: string) => void
  onOpenNode: (id: string) => void
}

const nodeTypes = { mindNode: MindNode }
const relationColors: Record<RelationType, string> = {
  related_to: 'rgba(148, 161, 214, 0.72)',
  depends_on: 'rgba(223, 186, 110, 0.82)',
  part_of: 'rgba(165, 140, 247, 0.8)',
  implements: 'rgba(114, 212, 226, 0.82)',
  contradicts: 'rgba(217, 151, 188, 0.88)',
  supports: 'rgba(129, 214, 170, 0.84)',
  references: 'rgba(157, 167, 188, 0.78)',
  derived_from: 'rgba(123, 162, 235, 0.82)',
  blocks: 'rgba(226, 122, 116, 0.88)',
  custom: 'rgba(223, 186, 110, 0.76)',
}
const nodeColor = (node: { data: unknown }) => {
  const data = node.data as CanvasNodeData
  return nodeColorHex[data.color] ?? '#9da7bc'
}

export default function KnowledgeGraphView(props: KnowledgeGraphViewProps) {
  return (
    <ReactFlowProvider>
      <KnowledgeGraphViewInner {...props} />
    </ReactFlowProvider>
  )
}

function KnowledgeGraphViewInner({ workspace, nodeIds, selectedNodeId, onSelectNode, onOpenNode }: KnowledgeGraphViewProps) {
  const idSet = useMemo(() => new Set(nodeIds), [nodeIds])
  const [isDragging, setIsDragging] = useState(false)
  const syncFlowNodes = useWorkspaceStore((state) => state.syncFlowNodes)
  const syncFlowEdges = useWorkspaceStore((state) => state.syncFlowEdges)
  const addEdge = useWorkspaceStore((state) => state.addEdge)

  const nodes = useMemo<FlowNode[]>(() => workspace.nodes
    .filter((node) => idSet.has(node.id) && knowledgeNodeTypes.includes(node.type))
    .map((node) => ({
      id: node.id,
      type: 'mindNode',
      position: node.position,
      data: { ...node, related: false, unrelated: false, dimmed: false },
      selected: node.id === selectedNodeId,
    })), [workspace.nodes, idSet, selectedNodeId])

  const edges = useMemo<Edge[]>(() => workspace.edges
    .filter((edge) => idSet.has(edge.sourceId) && idSet.has(edge.targetId))
    .map((edge) => {
      const stroke = relationColors[edge.relationType]
      return {
        id: edge.id,
        source: edge.sourceId,
        target: edge.targetId,
        label: getRelationCaption(edge),
        type: 'smoothstep',
        style: {
          stroke,
          strokeWidth: 1.5,
          ...(['custom', 'contradicts'].includes(edge.relationType) ? { strokeDasharray: '5 4' } : {}),
        },
        labelStyle: { fill: '#c2c6d5', fontSize: 9, fontFamily: 'DM Sans, sans-serif' },
        labelBgStyle: { fill: 'rgba(17, 21, 32, 0.9)', fillOpacity: 0.96, stroke: 'rgba(159, 171, 213, 0.12)', strokeWidth: 1 },
        labelBgPadding: [5, 3] as [number, number],
        labelBgBorderRadius: 5,
        markerEnd: { type: MarkerType.ArrowClosed, color: stroke, width: 13, height: 13 },
        interactionWidth: 18,
      }
    }), [workspace.edges, idSet])

  const handleSettledPositions = useCallback((positions: { id: string; position: { x: number; y: number } }[], removedIds: string[]) => {
    if (positions.length > 0 || removedIds.length > 0) syncFlowNodes(positions, removedIds)
  }, [syncFlowNodes])
  const handleNodesChange = useSynchronizedFlowNodes(nodes, handleSettledPositions)
  const handleNodeDragStart = useCallback(() => setIsDragging(true), [])
  const handleNodeDragStop = useCallback(() => setIsDragging(false), [])

  const handleEdgesChange = useCallback((changes: EdgeChange<Edge>[]) => {
    const removed = changes.flatMap((change) => change.type === 'remove' ? [change.id] : [])
    if (removed.length > 0) syncFlowEdges(removed)
  }, [syncFlowEdges])

  const handleConnect = useCallback((connection: Connection) => {
    if (connection.source && connection.target) addEdge(connection.source, connection.target)
  }, [addEdge])

  if (nodes.length === 0) {
    return <div className="knowledge-graph-empty"><span>Пока нечего отобразить</span><p>Измените фильтры или добавьте объект в базу знаний, чтобы построить граф.</p></div>
  }

  return (
    <div className="knowledge-graph-stage" aria-label="Холст графа базы знаний">
      <div className="knowledge-graph-stage__hint">Выберите узел для предпросмотра · Дважды щёлкните, чтобы открыть его на основном холсте · Перетащите маркеры, чтобы соединить узлы</div>
      <ReactFlow<FlowNode, Edge>
        className={`knowledge-graph-canvas${isDragging ? ' is-dragging' : ''}`}
        aria-label="Холст графа базы знаний"
        ariaLabelConfig={flowAriaLabelConfig}
        defaultNodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onNodeDragStart={handleNodeDragStart}
        onNodeDragStop={handleNodeDragStop}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onNodeClick={(_event, node) => onSelectNode(node.id)}
        onNodeDoubleClick={(_event, node) => onOpenNode(node.id)}
        connectionLineType={ConnectionLineType.SmoothStep}
        defaultEdgeOptions={{ type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } }}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1.1 }}
        minZoom={0.15}
        maxZoom={1.6}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={['Backspace', 'Delete']}
        onlyRenderVisibleElements
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(165, 172, 202, 0.18)" />
        <Controls aria-label="Управление графом" />
        <MiniMap ariaLabel="Мини-карта графа" nodeColor={nodeColor} maskColor="rgba(6, 8, 13, 0.7)" />
      </ReactFlow>
    </div>
  )
}
