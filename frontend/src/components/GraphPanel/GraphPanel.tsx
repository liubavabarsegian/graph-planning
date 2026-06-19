import { useState } from 'react'
import { Alert, Spin, Button, Modal, Form, Input, InputNumber, Select } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { updateTask, setTaskStatus, addTask, deleteTask, updateSubtask, addSubtask } from '../../api/graph'
import type { GraphNode, GraphEdge } from '../../types'
import { CytoscapeGraph } from './CytoscapeGraph'
import { TaskEditModal } from './TaskEditModal'

interface Props {
  planId: string | null
  nodes: GraphNode[]
  edges: GraphEdge[]
  onNodesUpdate: (nodes: GraphNode[], edges?: GraphEdge[]) => void
}

export function GraphPanel({ planId, nodes, edges, onNodesUpdate }: Props) {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addTaskOpen, setAddTaskOpen] = useState(false)
  const [addTaskForm] = Form.useForm()
  const [addingTask, setAddingTask] = useState(false)

  const refreshSelected = (updatedNodes: GraphNode[]) => {
    if (selectedNode) {
      const fresh = updatedNodes.find((n) => n.id === selectedNode.id)
      if (fresh) setSelectedNode(fresh)
    }
  }

  const handleSaveDuration = async (nodeId: string, durationDays: number) => {
    if (!planId) return
    setSaving(true)
    setError(null)
    try {
      const resp = await updateTask(planId, nodeId, { duration_days: durationDays })
      onNodesUpdate(resp.nodes)
      refreshSelected(resp.nodes)
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
      const updated = nodes.map((n) => n.id === nodeId ? { ...n, status } : n)
      onNodesUpdate(updated)
      if (selectedNode?.id === nodeId) setSelectedNode((prev) => prev ? { ...prev, status } : null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при смене статуса')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveDates = async (nodeId: string, startDate: string | null, endDate: string | null) => {
    if (!planId) return
    setSaving(true)
    setError(null)
    try {
      const patch: Record<string, string> = {}
      if (startDate !== null) patch.start_date = startDate
      if (endDate) patch.end_date = endDate
      const resp = await updateTask(planId, nodeId, patch)
      onNodesUpdate(resp.nodes)
      refreshSelected(resp.nodes)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при сдвиге дат')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveDescription = async (nodeId: string, description: string) => {
    if (!planId) return
    setSaving(true)
    setError(null)
    try {
      const resp = await updateTask(planId, nodeId, { description })
      onNodesUpdate(resp.nodes)
      refreshSelected(resp.nodes)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при сохранении описания')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleSubtask = async (nodeId: string, subtaskId: string, done: boolean) => {
    if (!planId) return
    setSaving(true)
    setError(null)
    try {
      const updatedNode = await updateSubtask(planId, nodeId, subtaskId, done)
      const updated = nodes.map((n) => n.id === nodeId ? updatedNode : n)
      onNodesUpdate(updated)
      setSelectedNode(updatedNode)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при обновлении подзадачи')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteTask = async (nodeId: string) => {
    if (!planId) return
    setSaving(true)
    setError(null)
    try {
      const resp = await deleteTask(planId, nodeId)
      // Перестраиваем рёбра из зависимостей
      const newEdges: GraphEdge[] = []
      for (const n of resp.nodes) {
        for (const dep of n.dependencies) {
          newEdges.push({ from: dep, to: n.id })
        }
      }
      onNodesUpdate(resp.nodes, newEdges)
      setSelectedNode(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при удалении задачи')
    } finally {
      setSaving(false)
    }
  }

  const handleAddSubtask = async (nodeId: string, title: string) => {
    if (!planId) return
    const updatedNode = await addSubtask(planId, nodeId, title)
    const updated = nodes.map((n) => n.id === nodeId ? updatedNode : n)
    onNodesUpdate(updated)
    setSelectedNode(updatedNode)
  }

  const handleAddTask = async () => {
    if (!planId) return
    const values = await addTaskForm.validateFields()
    setAddingTask(true)
    setError(null)
    try {
      const deps: string[] = values.dependencies ?? []
      const succs: string[] = values.successors ?? []
      const resp = await addTask(planId, {
        title: values.title,
        description: values.description ?? '',
        duration_days: values.duration_days,
        dependencies: deps,
        successors: succs,
      })
      const newEdges: GraphEdge[] = []
      for (const n of resp.nodes) {
        for (const dep of n.dependencies) {
          newEdges.push({ from: dep, to: n.id })
        }
      }
      onNodesUpdate(resp.nodes, newEdges)
      setAddTaskOpen(false)
      addTaskForm.resetFields()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при добавлении задачи')
    } finally {
      setAddingTask(false)
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

  const nodeOptions = nodes.map((n) => ({ value: n.id, label: `${n.id}: ${n.title}` }))

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

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 12px 0', gap: 8 }}>
        <Button
          size="small"
          icon={<PlusOutlined />}
          onClick={() => setAddTaskOpen(true)}
        >
          Добавить задачу
        </Button>
      </div>

      <div style={{ flex: 1 }}>
        <CytoscapeGraph
          nodes={nodes}
          edges={edges}
          onNodeClick={setSelectedNode}
        />
      </div>

      <TaskEditModal
        node={selectedNode}
        allNodes={nodes}
        onClose={() => setSelectedNode(null)}
        onSaveDuration={handleSaveDuration}
        onSaveStatus={handleSaveStatus}
        onSaveDescription={handleSaveDescription}
        onSaveDates={handleSaveDates}
        onToggleSubtask={handleToggleSubtask}
        onAddSubtask={handleAddSubtask}
        onDeleteTask={handleDeleteTask}
        saving={saving}
      />

      {/* Add task modal */}
      <Modal
        open={addTaskOpen}
        title="Добавить задачу"
        onCancel={() => { setAddTaskOpen(false); addTaskForm.resetFields() }}
        onOk={handleAddTask}
        okText="Добавить"
        cancelText="Отмена"
        confirmLoading={addingTask}
      >
        <Form form={addTaskForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="title"
            label="Название"
            rules={[{ required: true, message: 'Укажите название задачи' }]}
          >
            <Input placeholder="Название задачи" />
          </Form.Item>
          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={3} placeholder="Необязательно" />
          </Form.Item>
          <Form.Item
            name="duration_days"
            label="Длительность (дней)"
            rules={[{ required: true, message: 'Укажите длительность' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="dependencies"
            label="Зависит от"
            extra="Эти задачи должны завершиться до начала новой"
          >
            <Select mode="multiple" options={nodeOptions} placeholder="Выберите задачи" allowClear />
          </Form.Item>
          <Form.Item
            name="successors"
            label="Предшественник к"
            extra="Новая задача станет обязательной перед этими задачами"
          >
            <Select mode="multiple" options={nodeOptions} placeholder="Выберите задачи" allowClear />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
