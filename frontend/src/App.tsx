import { useState } from 'react'
import { Button, Typography } from 'antd'
import { LogoutOutlined } from '@ant-design/icons'
import { ChatPanel } from './components/ChatPanel/ChatPanel'
import { GraphPanel } from './components/GraphPanel/GraphPanel'
import { AuthPage } from './components/AuthPage/AuthPage'
import { getToken, clearToken } from './api/auth'
import type { Task, GraphNode, GraphEdge } from './types'
import { createPlan } from './api/graph'

const { Title, Text } = Typography

export function App() {
  const [authed, setAuthed] = useState<boolean>(() => !!getToken())
  const [planId, setPlanId] = useState<string | null>(null)
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([])
  const [graphEdges, setGraphEdges] = useState<GraphEdge[]>([])
  const [graphError, setGraphError] = useState<string | null>(null)

  const handleAuth = () => {
    setAuthed(true)
  }

  const handleLogout = () => {
    clearToken()
    setAuthed(false)
    setPlanId(null)
    setGraphNodes([])
    setGraphEdges([])
    setGraphError(null)
  }

  const handlePlanReady = async (tasks: Task[]) => {
    setGraphError(null)
    try {
      const today = new Date().toISOString().split('T')[0]
      const graph = await createPlan(tasks, today)
      setPlanId(graph.plan_id)
      setGraphNodes(graph.nodes)
      setGraphEdges(graph.edges)
    } catch (err) {
      setGraphError(err instanceof Error ? err.message : 'Ошибка создания графа')
    }
  }

  if (!authed) {
    return <AuthPage onAuth={handleAuth} />
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#fafafa' }}>
      {/* Левая колонка: чат */}
      <div
        style={{
          width: '40%',
          minWidth: 360,
          display: 'flex',
          flexDirection: 'column',
          background: '#fff',
          borderRight: '1px solid #f0f0f0',
          boxShadow: '2px 0 8px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>Goal Planner</Title>
            <Text type="secondary" style={{ fontSize: 12 }}>Опишите цель — получите план</Text>
          </div>
          <Button
            type="text"
            icon={<LogoutOutlined />}
            onClick={handleLogout}
            size="small"
            title="Выйти"
          />
        </div>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <ChatPanel onPlanReady={handlePlanReady} graphError={graphError} />
        </div>
      </div>

      {/* Правая колонка: граф */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <GraphPanel
          planId={planId}
          nodes={graphNodes}
          edges={graphEdges}
          onNodesUpdate={setGraphNodes}
        />
      </div>
    </div>
  )
}
