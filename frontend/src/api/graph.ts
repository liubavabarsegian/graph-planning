import type { Task, GraphResponse, UpdateTaskResponse } from '../types'

export async function createPlan(tasks: Task[], startDate?: string): Promise<GraphResponse> {
  const res = await fetch('/api/graph/plans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tasks, start_date: startDate }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }

  return res.json() as Promise<GraphResponse>
}

export async function updateTask(
  planId: string,
  taskId: string,
  patch: { duration_days?: number; title?: string; dependencies?: string[] }
): Promise<UpdateTaskResponse> {
  const res = await fetch(`/api/graph/plans/${planId}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }

  return res.json() as Promise<UpdateTaskResponse>
}
