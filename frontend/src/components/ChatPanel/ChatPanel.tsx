import { useState, useEffect, useRef, useCallback } from 'react'
import { sendMessage } from '../../api/chat'
import type { HistoryMessage, Task, GraphNode } from '../../types'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'

interface Props {
  planId: string | null
  onPlanReady: (tasks: Task[], goalTitle?: string) => void
  graphError: string | null
  currentNodes: GraphNode[]
}

const STORAGE_KEY = (planId: string) => `chat_history_${planId}`

function loadHistory(planId: string | null): HistoryMessage[] {
  if (!planId) return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY(planId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveHistory(planId: string | null, messages: HistoryMessage[]) {
  if (!planId) return
  try {
    localStorage.setItem(STORAGE_KEY(planId), JSON.stringify(messages.slice(-100)))
  } catch {
    // localStorage full — игнорируем
  }
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

export function ChatPanel({ planId, onPlanReady, graphError, currentNodes }: Props) {
  const [messages, setMessages] = useState<HistoryMessage[]>(() => loadHistory(planId))
  const [loading, setLoading] = useState(false)
  const [elapsed, setElapsed] = useState(0)   // секунды ожидания
  const [error, setError] = useState<string | null>(null)
  const [goalTitle, setGoalTitle] = useState<string>('')
  const prevPlanId = useRef<string | null>(planId)
  // Ref для доступа к актуальным messages внутри useEffect без добавления в deps.
  const messagesRef = useRef<HistoryMessage[]>(messages)
  useEffect(() => { messagesRef.current = messages }, [messages])

  // Когда planId меняется:
  // - null → newId: план только что создан из текущего диалога — мигрируем историю.
  // - oldId → newId: пользователь выбрал другой план — загружаем его историю.
  useEffect(() => {
    if (prevPlanId.current === planId) return
    const prevId = prevPlanId.current
    prevPlanId.current = planId

    if (prevId === null && planId !== null && messagesRef.current.length > 0) {
      // Только что создали план из активного диалога — мигрируем историю.
      saveHistory(planId, messagesRef.current)
    } else {
      // Переключение на существующий план (из истории, после перезагрузки страницы и т.д.)
      // — загружаем сохранённую историю. Важно: НЕ перезаписываем пустым массивом.
      setMessages(loadHistory(planId))
      setGoalTitle('')
      setError(null)
    }
  }, [planId])

  // Сохраняем историю при каждом изменении.
  useEffect(() => {
    saveHistory(planId, messages)
  }, [planId, messages])

  // Таймер прошедших секунд — показывает что модель ещё работает.
  const startTimer = useCallback(() => {
    setElapsed(0)
    const id = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const handleSend = async (text: string) => {
    const userMsg: HistoryMessage = { role: 'user', content: text }
    const nextHistory = [...messages, userMsg]

    setMessages(nextHistory)
    setLoading(true)
    setError(null)
    const stopTimer = startTimer()

    if (messages.length === 0) {
      setGoalTitle(text.slice(0, 80))
    }

    const currentTasks = currentNodes.length > 0 ? nodesToTasks(currentNodes) : undefined

    try {
      const response = await sendMessage(text, messages, currentTasks)
      const assistantMsg: HistoryMessage = { role: 'assistant', content: response.reply }
      const withAssistant = [...nextHistory, assistantMsg]
      setMessages(withAssistant)

      if (response.plan) {
        const title = goalTitle || text.slice(0, 80)
        onPlanReady(response.plan.tasks, title)
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Что-то пошло не так'
      const isConnectionError = raw.toLowerCase().includes('timeout') ||
        raw.toLowerCase().includes('network') ||
        raw.toLowerCase().includes('failed to fetch') ||
        raw === 'Unknown error'
      setError(isConnectionError
        ? 'Соединение прервалось. Попробуйте отправить сообщение ещё раз.'
        : raw)
    } finally {
      setLoading(false)
      stopTimer()
      setElapsed(0)
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
      {loading && elapsed >= 5 && (
        <div style={{ margin: '0 12px 8px', padding: '7px 12px', background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span>
          {elapsed < 30
            ? `Модель думает… ${elapsed} с`
            : elapsed < 90
            ? `Строю план, это займёт ещё немного… ${elapsed} с`
            : `Генерирую детальный план… ${elapsed} с`}
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
