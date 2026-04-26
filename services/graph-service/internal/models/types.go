package models

import "time"

// InputTask — задача, пришедшая от фронтенда (из chat-service).
type InputTask struct {
	ID           string   `json:"id"`
	Title        string   `json:"title"`
	Description  string   `json:"description"`
	DurationDays int      `json:"duration_days"`
	Dependencies []string `json:"dependencies"`
}

// GraphNode — задача с вычисленными датами и флагом критического пути.
type GraphNode struct {
	ID           string    `json:"id"`
	Title        string    `json:"title"`
	Description  string    `json:"description"`
	DurationDays int       `json:"duration_days"`
	StartDate    time.Time `json:"start_date"`
	EndDate      time.Time `json:"end_date"`
	IsCritical   bool      `json:"is_critical"`
	Dependencies []string  `json:"dependencies"`
}

// GraphEdge — ориентированное ребро зависимости.
type GraphEdge struct {
	From string `json:"from"`
	To   string `json:"to"`
}

// GraphResponse — ответ на создание/получение плана.
type GraphResponse struct {
	PlanID string      `json:"plan_id"`
	Nodes  []GraphNode `json:"nodes"`
	Edges  []GraphEdge `json:"edges"`
}

// CreatePlanRequest — тело POST /api/graph/plans.
type CreatePlanRequest struct {
	Tasks     []InputTask `json:"tasks"     binding:"required"`
	StartDate string      `json:"start_date"` // "YYYY-MM-DD", опционально
}

// UpdateTaskRequest — тело PATCH /api/graph/plans/:id/tasks/:taskId.
type UpdateTaskRequest struct {
	DurationDays *int     `json:"duration_days"`
	Title        *string  `json:"title"`
	Dependencies []string `json:"dependencies"`
}

// UpdateTaskResponse — ответ после пересчёта.
type UpdateTaskResponse struct {
	Nodes []GraphNode `json:"nodes"`
}
