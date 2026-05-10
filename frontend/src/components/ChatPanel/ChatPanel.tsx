import { useState } from 'react'
import { sendMessage } from '../../api/chat'
import type { HistoryMessage, Task, GraphNode } from '../../types'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'

interface Props {
  onPlanReady: (tasks: Task[], goalTitle?: string) => void
  graphError: string | null
  currentNodes: GraphNode[]
}

/** Convert GraphNodes to Task format for sending to LLM */
function nodesToTasks(nodes: GraphNode[]): Task[] {
  return nodes.map((n) => ({
    id: n.id,
    title: n.title,
    description: n.description,
    duration_days: n.duration_days,
    dependencies: n.dependencies,
  }))
}

export function ChatPanel({ onPlanReady, graphError, currentNodes }: Props) {
  const [messages, setMessages] = useState<HistoryMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [goalTitle, setGoalTitle] = useState<string>('')

  const handleSend = async (text: string) => {
    const userMsg: HistoryMessage = { role: 'user', content: text }
    const nextHistory = [...messages, userMsg]

    setMessages(nextHistory)
    setLoading(true)
    setError(null)

    if (messages.length === 0) {
      setGoalTitle(text.slice(0, 80))
    }

    const currentTasks = currentNodes.length > 0 ? nodesToTasks(currentNodes) : undefined

    try {
      const response = await sendMessage(text, messages, currentTasks)
      const assistantMsg: HistoryMessage = { role: 'assistant', content: response.reply }
      setMessages([...nextHistory, assistantMsg])

      if (response.plan) {
        const title = goalTitle || text.slice(0, 80)
        onPlanReady(response.plan.tasks, title)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Что-то пошло не так')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <MessageList messages={messages} />
      {error && (
        <div style={{ margin: '0 12px 8px', padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#dc2626' }}>
          {error}
          <button
            onClick={() => setError(null)}
            style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 14, lineHeight: 1 }}
          >×</button>
        </div>
      )}
      {graphError && (
        <div style={{ margin: '0 12px 8px', padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 12, color: '#b45309' }}>
          Ошибка графа: {graphError}
        </div>
      )}
      {currentNodes.length > 0 && (
        <div style={{ margin: '0 12px 8px', padding: '6px 12px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, fontSize: 11, color: '#0369a1' }}>
          Активный план: {currentNodes.length} задач. Можно попросить изменить его в чате.
        </div>
      )}
      <MessageInput onSend={handleSend} loading={loading} />
    </div>
  )
}
