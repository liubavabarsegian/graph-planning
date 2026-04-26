import { useState } from 'react'
import { Alert, Spin, Typography } from 'antd'
import { updateTask } from '../../api/graph'
import type { GraphNode, GraphEdge } from '../../types'
import { CytoscapeGraph } from './CytoscapeGraph'
import { TaskEditModal } from './TaskEditModal'

const { Text } = Typography

interface Props {
  planId: string | null
  nodes: GraphNode[]
  edges: GraphEdge[]
  onNodesUpdate: (nodes: GraphNode[]) => void
}

export function GraphPanel({ planId, nodes, edges, onNodesUpdate }: Props) {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async (nodeId: string, durationDays: number) => {
    if (!planId) return
    setSaving(true)
    setError(null)
    try {
      const resp = await updateTask(planId, nodeId, { duration_days: durationDays })
      onNodesUpdate(resp.nodes)
      setSelectedNode(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при обновлении')
    } finally {
      setSaving(false)
    }
  }

  if (!planId) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 8 }}>
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
          <circle cx="12" cy="32" r="8" stroke="#d9d9d9" strokeWidth="2" />
          <circle cx="32" cy="12" r="8" stroke="#d9d9d9" strokeWidth="2" />
          <circle cx="32" cy="52" r="8" stroke="#d9d9d9" strokeWidth="2" />
          <circle cx="52" cy="32" r="8" stroke="#d9d9d9" strokeWidth="2" />
          <line x1="20" y1="32" x2="24" y2="32" stroke="#d9d9d9" strokeWidth="2" />
          <line x1="32" y1="20" x2="32" y2="24" stroke="#d9d9d9" strokeWidth="2" />
          <line x1="32" y1="40" x2="32" y2="44" stroke="#d9d9d9" strokeWidth="2" />
          <line x1="40" y1="32" x2="44" y2="32" stroke="#d9d9d9" strokeWidth="2" />
        </svg>
        <Text type="secondary">Опишите цель в чате — здесь появится граф</Text>
      </div>
    )
  }

  if (nodes.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {error && (
        <Alert
          message={error}
          type="error"
          closable
          onClose={() => setError(null)}
          style={{ margin: 8 }}
        />
      )}
      <div style={{ flex: 1 }}>
        <CytoscapeGraph
          nodes={nodes}
          edges={edges}
          onNodeClick={setSelectedNode}
        />
      </div>
      <TaskEditModal
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  )
}
