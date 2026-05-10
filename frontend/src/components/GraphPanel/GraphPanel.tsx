import { useState } from 'react'
import { Alert, Spin } from 'antd'
import { updateTask, setTaskStatus } from '../../api/graph'
import type { GraphNode, GraphEdge } from '../../types'
import { CytoscapeGraph } from './CytoscapeGraph'
import { TaskEditModal } from './TaskEditModal'

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

  const handleSaveDuration = async (nodeId: string, durationDays: number) => {
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

  const handleSaveStatus = async (nodeId: string, status: string) => {
    if (!planId) return
    setSaving(true)
    setError(null)
    try {
      await setTaskStatus(planId, nodeId, status)
      // Optimistically update the status in the current nodes list
      const updated = nodes.map((n) =>
        n.id === nodeId ? { ...n, status } : n
      )
      onNodesUpdate(updated)
      // Update the selected node so the modal reflects the new status
      if (selectedNode?.id === nodeId) {
        setSelectedNode((prev) => prev ? { ...prev, status } : null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при смене статуса')
    } finally {
      setSaving(false)
    }
  }

  if (!planId) {
    return (
      <div className="graph-empty">
        <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
          <circle cx="12" cy="32" r="8" stroke="#d1d5db" strokeWidth="2" />
          <circle cx="32" cy="12" r="8" stroke="#d1d5db" strokeWidth="2" />
          <circle cx="32" cy="52" r="8" stroke="#d1d5db" strokeWidth="2" />
          <circle cx="52" cy="32" r="8" stroke="#d1d5db" strokeWidth="2" />
          <line x1="20" y1="32" x2="24" y2="32" stroke="#d1d5db" strokeWidth="2" />
          <line x1="32" y1="20" x2="32" y2="24" stroke="#d1d5db" strokeWidth="2" />
          <line x1="32" y1="40" x2="32" y2="44" stroke="#d1d5db" strokeWidth="2" />
          <line x1="40" y1="32" x2="44" y2="32" stroke="#d1d5db" strokeWidth="2" />
        </svg>
        <span className="graph-empty-text">Опишите цель в чате — здесь появится граф</span>
      </div>
    )
  }

  if (nodes.length === 0) {
    return (
      <div className="graph-empty">
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
        onSaveDuration={handleSaveDuration}
        onSaveStatus={handleSaveStatus}
        saving={saving}
      />
    </div>
  )
}
