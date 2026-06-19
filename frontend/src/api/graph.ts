import type { Task, GraphResponse, UpdateTaskResponse, PlanListItem, GraphNode } from '../types'
import { getToken, handleUnauthorized } from './auth'

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    handleUnauthorized()
    throw new Error('Сессия истекла, выполните вход снова')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

function authHeaders() {
  return { 'Authorization': `Bearer ${getToken()}` }
}

function jsonHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }
}

export async function listPlans(): Promise<PlanListItem[]> {
  const res = await fetch('/api/graph/plans', { headers: authHeaders() })
  return handleResponse<PlanListItem[]>(res)
}

export async function createPlan(tasks: Task[], startDate?: string, title?: string): Promise<GraphResponse> {
  // Конвертируем subtasks из string[] в [{id, title, done}] для graph-service.
  const normalizedTasks = tasks.map((t) => ({
    ...t,
    subtasks: (t.subtasks ?? []).map((s, i) =>
      typeof s === 'string'
        ? { id: '', title: s, done: false }
        : { id: s.id ?? `s${i + 1}`, title: s.title, done: s.done ?? false }
    ),
  }))
  const res = await fetch('/api/graph/plans', {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ tasks: normalizedTasks, start_date: startDate, title: title ?? '' }),
  })
  return handleResponse<GraphResponse>(res)
}

export async function getPlan(planId: string): Promise<GraphResponse> {
  const res = await fetch(`/api/graph/plans/${planId}`, { headers: authHeaders() })
  return handleResponse<GraphResponse>(res)
}

export async function deletePlan(planId: string): Promise<void> {
  const res = await fetch(`/api/graph/plans/${planId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
}

export async function addSubtask(planId: string, taskId: string, title: string): Promise<GraphNode> {
  const res = await fetch(`/api/graph/plans/${planId}/tasks/${taskId}/subtasks`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ title }),
  })
  return handleResponse<GraphNode>(res)
}

export async function addTask(
  planId: string,
  task: { title: string; description?: string; duration_days: number; dependencies?: string[]; successors?: string[] }
): Promise<UpdateTaskResponse> {
  const res = await fetch(`/api/graph/plans/${planId}/tasks`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(task),
  })
  return handleResponse<UpdateTaskResponse>(res)
}

export async function deleteTask(planId: string, taskId: string): Promise<UpdateTaskResponse> {
  const res = await fetch(`/api/graph/plans/${planId}/tasks/${taskId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  return handleResponse<UpdateTaskResponse>(res)
}

export async function updateTask(
  planId: string,
  taskId: string,
  patch: {
    duration_days?: number
    title?: string
    description?: string
    dependencies?: string[]
    start_date?: string  // "YYYY-MM-DD" или "" для сброса
    end_date?: string    // "YYYY-MM-DD"
  }
): Promise<UpdateTaskResponse> {
  const res = await fetch(`/api/graph/plans/${planId}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: jsonHeaders(),
    body: JSON.stringify(patch),
  })
  return handleResponse<UpdateTaskResponse>(res)
}

export async function setTaskStatus(planId: string, taskId: string, status: string): Promise<void> {
  const res = await fetch(`/api/graph/plans/${planId}/tasks/${taskId}/status`, {
    method: 'PATCH',
    headers: jsonHeaders(),
    body: JSON.stringify({ status }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
}

export async function updateSubtask(
  planId: string,
  taskId: string,
  subtaskId: string,
  done: boolean
): Promise<GraphNode> {
  const res = await fetch(`/api/graph/plans/${planId}/tasks/${taskId}/subtasks/${subtaskId}`, {
    method: 'PATCH',
    headers: jsonHeaders(),
    body: JSON.stringify({ done }),
  })
  return handleResponse<GraphNode>(res)
}
