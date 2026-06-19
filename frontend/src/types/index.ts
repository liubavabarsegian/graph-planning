export type Role = 'user' | 'assistant'

export interface HistoryMessage {
  role: Role
  content: string
}

export interface Task {
  id: string
  title: string
  description: string
  duration_days: number
  dependencies: string[]
  subtasks?: Array<{ id: string; title: string; done: boolean }>
}

export interface Plan {
  tasks: Task[]
}

export interface ChatResponse {
  reply: string
  plan: Plan | null
}

// --- Graph types ---

export interface Subtask {
  id: string
  title: string
  done: boolean
}

export interface GraphNode {
  id: string
  title: string
  description: string
  duration_days: number
  start_date: string  // "YYYY-MM-DD"
  end_date: string    // "YYYY-MM-DD"
  is_critical: boolean
  dependencies: string[]
  status: string      // "todo" | "in_progress" | "done"
  subtasks: Subtask[]
  forced_start?: string // "YYYY-MM-DD"
}

export interface GraphEdge {
  from: string
  to: string
}

export interface GraphResponse {
  plan_id: string
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface UpdateTaskResponse {
  nodes: GraphNode[]
}

export interface PlanListItem {
  id: string
  title: string
  created_at: string
}
