package models

// HistoryMessage — одно сообщение из истории диалога.
type HistoryMessage struct {
	Role    string `json:"role"`    // "user" | "assistant"
	Content string `json:"content"`
}

// ChatRequest — тело запроса POST /api/chat.
type ChatRequest struct {
	Message      string           `json:"message" binding:"required"`
	History      []HistoryMessage `json:"history"`
	CurrentTasks []Task           `json:"current_tasks"` // текущий план (если уже есть)
}

// Task — одна задача в плане.
type Task struct {
	ID           string   `json:"id"`
	Title        string   `json:"title"`
	Description  string   `json:"description"`
	DurationDays int      `json:"duration_days"`
	Dependencies []string `json:"dependencies"`
}

// Plan — список задач, возвращаемый вместе с ответом.
type Plan struct {
	Tasks []Task `json:"tasks"`
}

// ChatResponse — тело ответа на POST /api/chat.
type ChatResponse struct {
	Reply string `json:"reply"`
	Plan  *Plan  `json:"plan"` // nil, если план ещё не готов
}
