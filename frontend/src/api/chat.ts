import type { ChatResponse, HistoryMessage, Task } from '../types'
import { getToken, handleUnauthorized } from './auth'

export async function sendMessage(
  message: string,
  history: HistoryMessage[],
  currentTasks?: Task[]
): Promise<ChatResponse> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`,
    },
    body: JSON.stringify({
      message,
      history,
      current_tasks: currentTasks && currentTasks.length > 0 ? currentTasks : undefined,
    }),
  })

  if (res.status === 401) {
    handleUnauthorized()
    throw new Error('Сессия истекла, выполните вход снова')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }

  return res.json() as Promise<ChatResponse>
}
