package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"graph-service/internal/algorithms"
	"graph-service/internal/models"
	"graph-service/internal/storage"
)

// GraphService — бизнес-логика: оркестрирует алгоритмы и хранилища.
type GraphService struct {
	neo4j    *storage.Neo4jStore
	postgres *storage.PostgresStore
}

// NewGraphService создаёт сервис.
func NewGraphService(neo4j *storage.Neo4jStore, postgres *storage.PostgresStore) *GraphService {
	return &GraphService{neo4j: neo4j, postgres: postgres}
}

// CreatePlan валидирует DAG, вычисляет даты, сохраняет и возвращает граф.
func (s *GraphService) CreatePlan(ctx context.Context, userID, title string, tasks []models.InputTask, startDate time.Time) (*models.GraphResponse, error) {
	order, err := algorithms.TopologicalSort(tasks)
	if err != nil {
		return nil, fmt.Errorf("invalid graph: %w", err)
	}

	dates := algorithms.ComputeDates(tasks, order, startDate)
	critical := algorithms.ComputeCPM(tasks, order, dates)
	nodes := algorithms.BuildGraphNodes(tasks, dates, critical)
	edges := algorithms.BuildGraphEdges(tasks)

	planID := uuid.New().String()

	if err := s.postgres.SavePlan(ctx, planID, userID, title, startDate); err != nil {
		return nil, fmt.Errorf("save plan meta: %w", err)
	}
	if err := s.neo4j.SavePlan(ctx, planID, nodes); err != nil {
		return nil, fmt.Errorf("save plan graph: %w", err)
	}

	return &models.GraphResponse{
		PlanID: planID,
		Nodes:  nodes,
		Edges:  edges,
	}, nil
}

// GetPlan возвращает граф плана по ID. Проверяет принадлежность плана пользователю.
func (s *GraphService) GetPlan(ctx context.Context, userID, planID string) (*models.GraphResponse, error) {
	meta, err := s.postgres.GetPlan(ctx, planID)
	if err != nil {
		return nil, fmt.Errorf("plan not found: %s", planID)
	}
	if meta.UserID != "" && meta.UserID != userID {
		return nil, fmt.Errorf("plan not found: %s", planID)
	}

	nodes, err := s.neo4j.GetPlan(ctx, planID)
	if err != nil {
		return nil, fmt.Errorf("get plan from neo4j: %w", err)
	}
	if len(nodes) == 0 {
		return nil, fmt.Errorf("plan not found: %s", planID)
	}

	inputTasks := nodesToInputTasks(nodes)
	edges := algorithms.BuildGraphEdges(inputTasks)

	return &models.GraphResponse{
		PlanID: planID,
		Nodes:  nodes,
		Edges:  edges,
	}, nil
}

// UpdateTask обновляет задачу и каскадно пересчитывает все зависимые задачи.
func (s *GraphService) UpdateTask(ctx context.Context, userID, planID, taskID string, req models.UpdateTaskRequest) (*models.UpdateTaskResponse, error) {
	nodes, err := s.neo4j.GetPlan(ctx, planID)
	if err != nil {
		return nil, fmt.Errorf("get plan: %w", err)
	}

	meta, err := s.postgres.GetPlan(ctx, planID)
	if err != nil {
		return nil, fmt.Errorf("get plan meta: %w", err)
	}
	if meta.UserID != "" && meta.UserID != userID {
		return nil, fmt.Errorf("plan not found: %s", planID)
	}

	tasks := nodesToInputTasks(nodes)
	for i, t := range tasks {
		if t.ID == taskID {
			if req.DurationDays != nil {
				tasks[i].DurationDays = *req.DurationDays
			}
			if req.Title != nil {
				tasks[i].Title = *req.Title
			}
			if req.Description != nil {
				tasks[i].Description = *req.Description
			}
			if req.Dependencies != nil {
				tasks[i].Dependencies = req.Dependencies
			}
			// Принудительная дата начала — задача откладывается не раньше этой даты.
			if req.StartDate != nil {
				if *req.StartDate == "" {
					tasks[i].ForcedStart = nil // сброс
				} else if parsed, err := time.Parse(time.DateOnly, *req.StartDate); err == nil {
					d := models.DateOnly{Time: parsed}
					tasks[i].ForcedStart = &d
				}
			}
			// Дата окончания → пересчёт duration по формуле: duration = end - actualStart + 1.
			if req.EndDate != nil && *req.EndDate != "" {
				if endParsed, err := time.Parse(time.DateOnly, *req.EndDate); err == nil {
					// Ищем текущую StartDate из nodes (GraphNode).
					currentStart := meta.StartDate
					for _, n := range nodes {
						if n.ID == taskID {
							currentStart = n.StartDate.Time
							break
						}
					}
					newDur := int(endParsed.Sub(currentStart).Hours()/24) + 1
					if newDur < 1 {
						newDur = 1
					}
					tasks[i].DurationDays = newDur
				}
			}
			break
		}
	}

	order, err := algorithms.TopologicalSort(tasks)
	if err != nil {
		return nil, fmt.Errorf("invalid graph after update: %w", err)
	}

	dates := algorithms.ComputeDates(tasks, order, meta.StartDate)
	critical := algorithms.ComputeCPM(tasks, order, dates)
	updatedNodes := algorithms.BuildGraphNodes(tasks, dates, critical)

	if err := s.neo4j.UpdateTask(ctx, planID, taskID, updatedNodes); err != nil {
		return nil, fmt.Errorf("update neo4j: %w", err)
	}

	return &models.UpdateTaskResponse{Nodes: updatedNodes}, nil
}

// DeletePlan удаляет план из PostgreSQL и Neo4j.
func (s *GraphService) DeletePlan(ctx context.Context, userID, planID string) error {
	if err := s.postgres.DeletePlan(ctx, planID, userID); err != nil {
		return err
	}
	return s.neo4j.DeletePlan(ctx, planID)
}

// AddTask добавляет новую задачу в существующий план и пересчитывает граф.
func (s *GraphService) AddTask(ctx context.Context, userID, planID string, req models.AddTaskRequest) (*models.UpdateTaskResponse, error) {
	nodes, err := s.neo4j.GetPlan(ctx, planID)
	if err != nil {
		return nil, fmt.Errorf("get plan: %w", err)
	}

	meta, err := s.postgres.GetPlan(ctx, planID)
	if err != nil {
		return nil, fmt.Errorf("get plan meta: %w", err)
	}
	if meta.UserID != "" && meta.UserID != userID {
		return nil, fmt.Errorf("plan not found: %s", planID)
	}

	// Генерируем уникальный ID для новой задачи.
	newID := generateTaskID(nodes)

	tasks := nodesToInputTasks(nodes)
	deps := req.Dependencies
	if deps == nil {
		deps = []string{}
	}
	tasks = append(tasks, models.InputTask{
		ID:           newID,
		Title:        req.Title,
		Description:  req.Description,
		DurationDays: req.DurationDays,
		Dependencies: deps,
		Status:       "todo",
		Subtasks:     []models.Subtask{},
	})

	// Добавляем новую задачу как зависимость для указанных successor-задач.
	for i := range tasks {
		for _, succID := range req.Successors {
			if tasks[i].ID == succID {
				tasks[i].Dependencies = append(tasks[i].Dependencies, newID)
			}
		}
	}

	order, err := algorithms.TopologicalSort(tasks)
	if err != nil {
		return nil, fmt.Errorf("invalid graph after add: %w", err)
	}

	dates := algorithms.ComputeDates(tasks, order, meta.StartDate)
	critical := algorithms.ComputeCPM(tasks, order, dates)
	updatedNodes := algorithms.BuildGraphNodes(tasks, dates, critical)

	// SavePlan использует MERGE — безопасно создаёт новый узел и пересоздаёт все рёбра.
	if err := s.neo4j.SavePlan(ctx, planID, updatedNodes); err != nil {
		return nil, fmt.Errorf("save updated graph: %w", err)
	}

	return &models.UpdateTaskResponse{Nodes: updatedNodes}, nil
}

// DeleteTask удаляет задачу из плана, чинит зависимости и пересчитывает граф.
func (s *GraphService) DeleteTask(ctx context.Context, userID, planID, taskID string) (*models.UpdateTaskResponse, error) {
	nodes, err := s.neo4j.GetPlan(ctx, planID)
	if err != nil {
		return nil, fmt.Errorf("get plan: %w", err)
	}

	meta, err := s.postgres.GetPlan(ctx, planID)
	if err != nil {
		return nil, fmt.Errorf("get plan meta: %w", err)
	}
	if meta.UserID != "" && meta.UserID != userID {
		return nil, fmt.Errorf("plan not found: %s", planID)
	}

	// Удаляем узел из Neo4j.
	if err := s.neo4j.DeleteTaskNode(ctx, planID, taskID); err != nil {
		return nil, fmt.Errorf("delete task node: %w", err)
	}

	// Удаляем задачу и все её упоминания из зависимостей.
	tasks := nodesToInputTasks(nodes)
	remaining := make([]models.InputTask, 0, len(tasks)-1)
	for _, t := range tasks {
		if t.ID == taskID {
			continue
		}
		newDeps := make([]string, 0, len(t.Dependencies))
		for _, dep := range t.Dependencies {
			if dep != taskID {
				newDeps = append(newDeps, dep)
			}
		}
		t.Dependencies = newDeps
		remaining = append(remaining, t)
	}

	if len(remaining) == 0 {
		return &models.UpdateTaskResponse{Nodes: []models.GraphNode{}}, nil
	}

	order, err := algorithms.TopologicalSort(remaining)
	if err != nil {
		return nil, fmt.Errorf("invalid graph after delete: %w", err)
	}

	dates := algorithms.ComputeDates(remaining, order, meta.StartDate)
	critical := algorithms.ComputeCPM(remaining, order, dates)
	updatedNodes := algorithms.BuildGraphNodes(remaining, dates, critical)

	if err := s.neo4j.UpdateTask(ctx, planID, "", updatedNodes); err != nil {
		return nil, fmt.Errorf("update neo4j: %w", err)
	}

	return &models.UpdateTaskResponse{Nodes: updatedNodes}, nil
}

// UpdateSubtask переключает done у подзадачи и автоматически обновляет статус задачи.
func (s *GraphService) UpdateSubtask(ctx context.Context, userID, planID, taskID, subtaskID string, done bool) (*models.GraphNode, error) {
	meta, err := s.postgres.GetPlan(ctx, planID)
	if err != nil {
		return nil, fmt.Errorf("plan not found: %s", planID)
	}
	if meta.UserID != "" && meta.UserID != userID {
		return nil, fmt.Errorf("plan not found: %s", planID)
	}

	subtasks, newStatus, err := s.neo4j.UpdateSubtask(ctx, planID, taskID, subtaskID, done)
	if err != nil {
		return nil, err
	}

	// Читаем обновлённый узел для ответа.
	nodes, err := s.neo4j.GetPlan(ctx, planID)
	if err != nil {
		return nil, fmt.Errorf("reload plan: %w", err)
	}
	for i := range nodes {
		if nodes[i].ID == taskID {
			nodes[i].Subtasks = subtasks
			nodes[i].Status = newStatus
			return &nodes[i], nil
		}
	}

	return nil, fmt.Errorf("task not found after update: %s", taskID)
}

// AddSubtask добавляет подзадачу к задаче и возвращает обновлённый узел.
func (s *GraphService) AddSubtask(ctx context.Context, userID, planID, taskID, title string) (*models.GraphNode, error) {
	meta, err := s.postgres.GetPlan(ctx, planID)
	if err != nil {
		return nil, fmt.Errorf("plan not found: %s", planID)
	}
	if meta.UserID != "" && meta.UserID != userID {
		return nil, fmt.Errorf("plan not found: %s", planID)
	}

	subtasks, err := s.neo4j.AddSubtask(ctx, planID, taskID, title)
	if err != nil {
		return nil, err
	}

	nodes, err := s.neo4j.GetPlan(ctx, planID)
	if err != nil {
		return nil, fmt.Errorf("reload plan: %w", err)
	}
	for i := range nodes {
		if nodes[i].ID == taskID {
			nodes[i].Subtasks = subtasks
			return &nodes[i], nil
		}
	}
	return nil, fmt.Errorf("task not found: %s", taskID)
}

// ListUserPlans возвращает список планов пользователя.
func (s *GraphService) ListUserPlans(ctx context.Context, userID string) ([]models.PlanSummary, error) {
	metas, err := s.postgres.GetUserPlans(ctx, userID)
	if err != nil {
		return nil, err
	}
	result := make([]models.PlanSummary, len(metas))
	for i, m := range metas {
		title := m.Title
		if title == "" {
			title = "План " + m.ID[:8]
		}
		result[i] = models.PlanSummary{
			ID:        m.ID,
			Title:     title,
			CreatedAt: m.CreatedAt.Format(time.RFC3339),
		}
	}
	return result, nil
}

// SetTaskStatus обновляет статус задачи без пересчёта дат.
func (s *GraphService) SetTaskStatus(ctx context.Context, userID, planID, taskID, status string) error {
	meta, err := s.postgres.GetPlan(ctx, planID)
	if err != nil {
		return fmt.Errorf("plan not found: %s", planID)
	}
	if meta.UserID != "" && meta.UserID != userID {
		return fmt.Errorf("plan not found: %s", planID)
	}

	return s.neo4j.SetTaskStatus(ctx, planID, taskID, status)
}

// --- helpers ---

func nodesToInputTasks(nodes []models.GraphNode) []models.InputTask {
	tasks := make([]models.InputTask, len(nodes))
	for i, n := range nodes {
		tasks[i] = models.InputTask{
			ID:           n.ID,
			Title:        n.Title,
			Description:  n.Description,
			DurationDays: n.DurationDays,
			Dependencies: n.Dependencies,
			Status:       n.Status,
			Subtasks:     n.Subtasks,
			ForcedStart:  n.ForcedStart,
		}
	}
	return tasks
}

// generateTaskID создаёт ID вида "t<N+1>" где N — максимальный числовой суффикс.
func generateTaskID(nodes []models.GraphNode) string {
	max := 0
	for _, n := range nodes {
		var num int
		if _, err := fmt.Sscanf(n.ID, "t%d", &num); err == nil && num > max {
			max = num
		}
	}
	return fmt.Sprintf("t%d", max+1)
}
