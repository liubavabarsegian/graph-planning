import type { Task, GraphResponse, UpdateTaskResponse, PlanListItem } from '../types'
import { getToken } from './auth'

export async function listPlans(): Promise<PlanListItem[]> {
  const res = await fetch('/api/graph/plans', {
    headers: { 'Authorization': `Bearer ${getToken()}` },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<PlanListItem[]>
}

export async function createPlan(tasks: Task[], startDate?: string, title?: string): Promise<GraphResponse> {
  const res = await fetch('/api/graph/plans', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ tasks, start_date: startDate, title: title ?? '' }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }

  return res.json() as Promise<GraphResponse>
}

export async function getPlan(planId: string): Promise<GraphResponse> {
  const res = await fetch(`/api/graph/plans/${planId}`, {
    headers: { 'Authorization': `Bearer ${getToken()}` },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<GraphResponse>
}

export async function setTaskStatus(planId: string, taskId: string, status: string): Promise<void> {
  const res = await fetch(`/api/graph/plans/${planId}/tasks/${taskId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ status }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
}

export async function updateTask(
  planId: string,
  taskId: string,
  patch: { duration_days?: number; title?: string; dependencies?: string[] }
): Promise<UpdateTaskResponse> {
  const res = await fetch(`/api/graph/plans/${planId}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`,
    },
    body: JSON.stringify(patch),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }

  return res.json() as Promise<UpdateTaskResponse>
}
