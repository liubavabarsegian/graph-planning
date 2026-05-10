package models

import (
	"fmt"
	"time"
)

// DateOnly — обёртка над time.Time, сериализуется/десериализуется как "YYYY-MM-DD".
type DateOnly struct {
	time.Time
}

func (d DateOnly) MarshalJSON() ([]byte, error) {
	return []byte(`"` + d.Time.Format(time.DateOnly) + `"`), nil
}

func (d *DateOnly) UnmarshalJSON(data []byte) error {
	if len(data) < 2 {
		return fmt.Errorf("invalid date: %s", data)
	}
	s := string(data[1 : len(data)-1])
	t, err := time.Parse(time.DateOnly, s)
	if err != nil {
		return fmt.Errorf("parse date %q: %w", s, err)
	}
	d.Time = t
	return nil
}

// InputTask — задача, пришедшая от фронтенда (из chat-service).
type InputTask struct {
	ID           string   `json:"id"`
	Title        string   `json:"title"`
	Description  string   `json:"description"`
	DurationDays int      `json:"duration_days"`
	Dependencies []string `json:"dependencies"`
	Status       string   `json:"status"` // "todo" | "in_progress" | "done"
}

// GraphNode — задача с вычисленными датами и флагом критического пути.
type GraphNode struct {
	ID           string   `json:"id"`
	Title        string   `json:"title"`
	Description  string   `json:"description"`
	DurationDays int      `json:"duration_days"`
	StartDate    DateOnly `json:"start_date"`
	EndDate      DateOnly `json:"end_date"`
	IsCritical   bool     `json:"is_critical"`
	Dependencies []string `json:"dependencies"`
	Status       string   `json:"status"` // "todo" | "in_progress" | "done"
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
	Title     string      `json:"title"`      // название цели
}

// PlanSummary — краткая информация о плане для списка.
type PlanSummary struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	CreatedAt string `json:"created_at"` // ISO 8601
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

// SetTaskStatusRequest — тело PATCH /api/graph/plans/:id/tasks/:taskId/status.
type SetTaskStatusRequest struct {
	Status string `json:"status" binding:"required,oneof=todo in_progress done"`
}
