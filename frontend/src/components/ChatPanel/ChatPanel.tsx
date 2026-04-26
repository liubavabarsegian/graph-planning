import { useState } from 'react'
import { Alert } from 'antd'
import { sendMessage } from '../../api/chat'
import type { HistoryMessage, Task } from '../../types'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'
import { TaskPreview } from './TaskPreview'

interface Props {
  onPlanReady: (tasks: Task[]) => void
  graphError: string | null
}

export function ChatPanel({ onPlanReady, graphError }: Props) {
  const [messages, setMessages] = useState<HistoryMessage[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSend = async (text: string) => {
    const userMsg: HistoryMessage = { role: 'user', content: text }
    const nextHistory = [...messages, userMsg]

    setMessages(nextHistory)
    setLoading(true)
    setError(null)

    try {
      const response = await sendMessage(text, messages)

      const assistantMsg: HistoryMessage = { role: 'assistant', content: response.reply }
      setMessages([...nextHistory, assistantMsg])

      if (response.plan) {
        setTasks(response.plan.tasks)
        onPlanReady(response.plan.tasks)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Что-то пошло не так')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <MessageList messages={messages} />
      {error && (
        <Alert
          message={error}
          type="error"
          closable
          onClose={() => setError(null)}
          style={{ margin: '0 16px 8px' }}
        />
      )}
      {graphError && (
        <Alert
          message={`Ошибка графа: ${graphError}`}
          type="warning"
          closable
          style={{ margin: '0 16px 8px' }}
        />
      )}
      {tasks.length > 0 && <TaskPreview tasks={tasks} />}
      <MessageInput onSend={handleSend} loading={loading} />
    </div>
  )
}
