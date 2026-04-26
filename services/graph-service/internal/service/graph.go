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
func (s *GraphService) CreatePlan(ctx context.Context, tasks []models.InputTask, startDate time.Time) (*models.GraphResponse, error) {
	// 1. Топологическая сортировка (детектирует циклы)
	order, err := algorithms.TopologicalSort(tasks)
	if err != nil {
		return nil, fmt.Errorf("invalid graph: %w", err)
	}

	// 2. Forward pass
	dates := algorithms.ComputeDates(tasks, order, startDate)

	// 3. CPM
	critical := algorithms.ComputeCPM(tasks, order, dates)

	// 4. Собираем узлы
	nodes := algorithms.BuildGraphNodes(tasks, dates, critical)
	edges := algorithms.BuildGraphEdges(tasks)

	// 5. Сохраняем
	planID := uuid.New().String()

	if err := s.postgres.SavePlan(ctx, planID, startDate); err != nil {
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

// GetPlan возвращает граф плана по ID.
func (s *GraphService) GetPlan(ctx context.Context, planID string) (*models.GraphResponse, error) {
	// Получаем узлы из Neo4j
	nodes, err := s.neo4j.GetPlan(ctx, planID)
	if err != nil {
		return nil, fmt.Errorf("get plan from neo4j: %w", err)
	}
	if len(nodes) == 0 {
		return nil, fmt.Errorf("plan not found: %s", planID)
	}

	// Восстанавливаем рёбра из nodes.Dependencies
	inputTasks := nodesToInputTasks(nodes)
	edges := algorithms.BuildGraphEdges(inputTasks)

	return &models.GraphResponse{
		PlanID: planID,
		Nodes:  nodes,
		Edges:  edges,
	}, nil
}

// UpdateTask обновляет задачу и каскадно пересчитывает все зависимые задачи.
func (s *GraphService) UpdateTask(ctx context.Context, planID, taskID string, req models.UpdateTaskRequest) (*models.UpdateTaskResponse, error) {
	// 1. Загружаем весь план
	nodes, err := s.neo4j.GetPlan(ctx, planID)
	if err != nil {
		return nil, fmt.Errorf("get plan: %w", err)
	}

	// Получаем start_date плана из PostgreSQL
	meta, err := s.postgres.GetPlan(ctx, planID)
	if err != nil {
		return nil, fmt.Errorf("get plan meta: %w", err)
	}

	// 2. Применяем изменения к целевой задаче
	tasks := nodesToInputTasks(nodes)
	for i, t := range tasks {
		if t.ID == taskID {
			if req.DurationDays != nil {
				tasks[i].DurationDays = *req.DurationDays
			}
			if req.Title != nil {
				tasks[i].Title = *req.Title
			}
			if req.Dependencies != nil {
				tasks[i].Dependencies = req.Dependencies
			}
			break
		}
	}

	// 3. Пересчитываем граф полностью
	order, err := algorithms.TopologicalSort(tasks)
	if err != nil {
		return nil, fmt.Errorf("invalid graph after update: %w", err)
	}

	dates := algorithms.ComputeDates(tasks, order, meta.StartDate)
	critical := algorithms.ComputeCPM(tasks, order, dates)
	updatedNodes := algorithms.BuildGraphNodes(tasks, dates, critical)

	// 4. Сохраняем обновлённые данные в Neo4j
	if err := s.neo4j.UpdateTask(ctx, planID, taskID, updatedNodes); err != nil {
		return nil, fmt.Errorf("update neo4j: %w", err)
	}

	return &models.UpdateTaskResponse{Nodes: updatedNodes}, nil
}

// nodesToInputTasks преобразует GraphNode → InputTask для алгоритмов.
func nodesToInputTasks(nodes []models.GraphNode) []models.InputTask {
	tasks := make([]models.InputTask, len(nodes))
	for i, n := range nodes {
		tasks[i] = models.InputTask{
			ID:           n.ID,
			Title:        n.Title,
			Description:  n.Description,
			DurationDays: n.DurationDays,
			Dependencies: n.Dependencies,
		}
	}
	return tasks
}
