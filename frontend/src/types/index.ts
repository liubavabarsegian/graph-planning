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
