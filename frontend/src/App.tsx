import { useState, useCallback } from 'react'
import { ChatPanel } from './components/ChatPanel/ChatPanel'
import { GraphPanel } from './components/GraphPanel/GraphPanel'
import { AuthPage } from './components/AuthPage/AuthPage'
import { PlansList } from './components/PlansList/PlansList'
import { getToken, clearToken } from './api/auth'
import { getPlan } from './api/graph'
import type { Task, GraphNode, GraphEdge } from './types'
import { createPlan } from './api/graph'

export function App() {
  const [authed, setAuthed] = useState<boolean>(() => !!getToken())
  const [planId, setPlanId] = useState<string | null>(null)
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([])
  const [graphEdges, setGraphEdges] = useState<GraphEdge[]>([])
  const [graphError, setGraphError] = useState<string | null>(null)
  const [chatKey, setChatKey] = useState(0)
  const [plansRefresh, setPlansRefresh] = useState(0)

  const handleAuth = () => setAuthed(true)

  const handleLogout = () => {
    clearToken()
    setAuthed(false)
    setPlanId(null)
    setGraphNodes([])
    setGraphEdges([])
    setGraphError(null)
  }

  const handlePlanReady = useCallback(async (tasks: Task[], goalTitle?: string) => {
    setGraphError(null)
    try {
      const today = new Date().toISOString().split('T')[0]
      const graph = await createPlan(tasks, today, goalTitle)
      setPlanId(graph.plan_id)
      setGraphNodes(graph.nodes)
      setGraphEdges(graph.edges)
      setPlansRefresh((n) => n + 1)
    } catch (err) {
      setGraphError(err instanceof Error ? err.message : 'Ошибка создания графа')
    }
  }, [])

  const handleSelectPlan = async (id: string) => {
    setGraphError(null)
    try {
      const graph = await getPlan(id)
      setPlanId(graph.plan_id)
      setGraphNodes(graph.nodes)
      setGraphEdges(graph.edges)
    } catch (err) {
      setGraphError(err instanceof Error ? err.message : 'Ошибка загрузки плана')
    }
  }

  const handleNewPlan = () => {
    setPlanId(null)
    setGraphNodes([])
    setGraphEdges([])
    setGraphError(null)
    setChatKey((k) => k + 1)
  }

  if (!authed) {
    return <AuthPage onAuth={handleAuth} />
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <PlansList
        activePlanId={planId}
        onSelectPlan={handleSelectPlan}
        onNewPlan={handleNewPlan}
        refreshTrigger={plansRefresh}
      />

      {/* Chat */}
      <div className="chat-panel">
        <div className="chat-header">
          <div>
            <div className="chat-header-title">Планировщик целей</div>
            <div className="chat-header-sub">Опишите цель — получите план</div>
          </div>
          <button className="logout-btn" onClick={handleLogout} title="Выйти">
            ⏻
          </button>
        </div>
        <ChatPanel
          key={chatKey}
          onPlanReady={handlePlanReady}
          graphError={graphError}
          currentNodes={graphNodes}
        />
      </div>

      {/* Graph */}
      <div className="graph-area">
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
