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
}

export interface Plan {
  tasks: Task[]
}

export interface ChatResponse {
  reply: string
  plan: Plan | null
}

// --- Graph types ---

export interface GraphNode {
  id: string
  title: string
  description: string
  duration_days: number
  start_date: string  // "YYYY-MM-DD"
  end_date: string    // "YYYY-MM-DD"
  is_critical: boolean
  dependencies: string[]
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
