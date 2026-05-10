package storage

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/neo4j/neo4j-go-driver/v5/neo4j"

	"graph-service/internal/models"
)

// Neo4jStore работает с графом в Neo4j.
type Neo4jStore struct {
	driver neo4j.DriverWithContext
}

// NewNeo4jStore подключается к Neo4j.
func NewNeo4jStore(ctx context.Context, uri, user, pass string) (*Neo4jStore, error) {
	driver, err := neo4j.NewDriverWithContext(uri, neo4j.BasicAuth(user, pass, ""))
	if err != nil {
		return nil, fmt.Errorf("create neo4j driver: %w", err)
	}
	if err := driver.VerifyConnectivity(ctx); err != nil {
		return nil, fmt.Errorf("neo4j connectivity: %w", err)
	}
	return &Neo4jStore{driver: driver}, nil
}

// SavePlan сохраняет все узлы и рёбра плана в Neo4j.
func (s *Neo4jStore) SavePlan(ctx context.Context, planID string, nodes []models.GraphNode) error {
	session := s.driver.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)

	_, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		// Создаём узлы
		for _, n := range nodes {
			status := n.Status
			if status == "" {
				status = "todo"
			}
			_, err := tx.Run(ctx, `
				MERGE (t:Task {id: $id, plan_id: $planID})
				SET t.title        = $title,
				    t.description  = $description,
				    t.duration_days = $duration,
				    t.start_date   = $startDate,
				    t.end_date     = $endDate,
				    t.is_critical  = $isCritical,
				    t.status       = $status
			`, map[string]any{
				"id":          n.ID,
				"planID":      planID,
				"title":       n.Title,
				"description": n.Description,
				"duration":    n.DurationDays,
				"startDate":   n.StartDate.Format(time.DateOnly),
				"endDate":     n.EndDate.Format(time.DateOnly),
				"isCritical":  n.IsCritical,
				"status":      status,
			})
			if err != nil {
				return nil, err
			}
		}

		// Создаём рёбра зависимостей
		for _, n := range nodes {
			for _, depID := range n.Dependencies {
				_, err := tx.Run(ctx, `
					MATCH (dep:Task {id: $depID, plan_id: $planID})
					MATCH (cur:Task {id: $curID, plan_id: $planID})
					MERGE (dep)-[:DEPENDS_ON]->(cur)
				`, map[string]any{
					"depID":  depID,
					"curID":  n.ID,
					"planID": planID,
				})
				if err != nil {
					return nil, err
				}
			}
		}

		return nil, nil
	})

	return err
}

// GetPlan возвращает все узлы плана из Neo4j.
func (s *Neo4jStore) GetPlan(ctx context.Context, planID string) ([]models.GraphNode, error) {
	session := s.driver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeRead})
	defer session.Close(ctx)

	result, err := session.ExecuteRead(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		res, err := tx.Run(ctx, `
			MATCH (t:Task {plan_id: $planID})
			OPTIONAL MATCH (dep:Task {plan_id: $planID})-[:DEPENDS_ON]->(t)
			RETURN t, collect(dep.id) AS deps
		`, map[string]any{"planID": planID})
		if err != nil {
			return nil, err
		}

		var nodes []models.GraphNode
		for res.Next(ctx) {
			rec := res.Record()
			node, _ := rec.Get("t")
			depsRaw, _ := rec.Get("deps")

			taskNode, ok := node.(neo4j.Node)
			if !ok {
				continue
			}

			n, err := nodeFromProps(taskNode.Props, depsRaw)
			if err != nil {
				return nil, err
			}
			nodes = append(nodes, n)
		}

		return nodes, res.Err()
	})

	if err != nil {
		return nil, err
	}

	nodes, _ := result.([]models.GraphNode)
	return nodes, nil
}

// UpdateTask обновляет свойства всех задач плана и пересоздаёт рёбра зависимостей.
func (s *Neo4jStore) UpdateTask(ctx context.Context, planID, taskID string, updatedNodes []models.GraphNode) error {
	session := s.driver.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)

	_, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		// Удаляем все старые рёбра плана
		_, err := tx.Run(ctx, `
			MATCH (t:Task {plan_id: $planID})-[r:DEPENDS_ON]->()
			DELETE r
		`, map[string]any{"planID": planID})
		if err != nil {
			return nil, err
		}

		// Обновляем свойства узлов
		for _, n := range updatedNodes {
			status := n.Status
			if status == "" {
				status = "todo"
			}
			_, err := tx.Run(ctx, `
				MATCH (t:Task {id: $id, plan_id: $planID})
				SET t.title         = $title,
				    t.duration_days  = $duration,
				    t.start_date    = $startDate,
				    t.end_date      = $endDate,
				    t.is_critical   = $isCritical,
				    t.status        = $status
			`, map[string]any{
				"id":         n.ID,
				"planID":     planID,
				"title":      n.Title,
				"duration":   n.DurationDays,
				"startDate":  n.StartDate.Format(time.DateOnly),
				"endDate":    n.EndDate.Format(time.DateOnly),
				"isCritical": n.IsCritical,
				"status":     status,
			})
			if err != nil {
				return nil, err
			}
		}

		// Пересоздаём рёбра зависимостей
		for _, n := range updatedNodes {
			for _, depID := range n.Dependencies {
				_, err := tx.Run(ctx, `
					MATCH (dep:Task {id: $depID, plan_id: $planID})
					MATCH (cur:Task {id: $curID, plan_id: $planID})
					MERGE (dep)-[:DEPENDS_ON]->(cur)
				`, map[string]any{
					"depID":  depID,
					"curID":  n.ID,
					"planID": planID,
				})
				if err != nil {
					return nil, err
				}
			}
		}

		return nil, nil
	})

	return err
}

// SetTaskStatus обновляет только поле status одной задачи.
func (s *Neo4jStore) SetTaskStatus(ctx context.Context, planID, taskID, status string) error {
	session := s.driver.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)

	_, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		result, err := tx.Run(ctx, `
			MATCH (t:Task {id: $taskID, plan_id: $planID})
			SET t.status = $status
			RETURN count(t) AS updated
		`, map[string]any{
			"taskID": taskID,
			"planID": planID,
			"status": status,
		})
		if err != nil {
			return nil, err
		}
		rec, err := result.Single(ctx)
		if err != nil {
			return nil, fmt.Errorf("task not found: %s", taskID)
		}
		updated, _ := rec.Get("updated")
		if updated.(int64) == 0 {
			return nil, fmt.Errorf("task not found: %s", taskID)
		}
		return nil, nil
	})

	return err
}

// Close закрывает драйвер.
func (s *Neo4jStore) Close(ctx context.Context) {
	s.driver.Close(ctx)
}

// --- helpers ---

func nodeFromProps(props map[string]any, depsRaw any) (models.GraphNode, error) {
	startDate, err := parseDate(props["start_date"])
	if err != nil {
		return models.GraphNode{}, fmt.Errorf("parse start_date: %w", err)
	}
	endDate, err := parseDate(props["end_date"])
	if err != nil {
		return models.GraphNode{}, fmt.Errorf("parse end_date: %w", err)
	}

	deps := extractStringSlice(depsRaw)

	status := getString(props, "status")
	if status == "" {
		status = "todo"
	}

	return models.GraphNode{
		ID:           getString(props, "id"),
		Title:        getString(props, "title"),
		Description:  getString(props, "description"),
		DurationDays: getInt(props, "duration_days"),
		StartDate:    models.DateOnly{Time: startDate},
		EndDate:      models.DateOnly{Time: endDate},
		IsCritical:   getBool(props, "is_critical"),
		Dependencies: deps,
		Status:       status,
	}, nil
}

func parseDate(v any) (time.Time, error) {
	s, ok := v.(string)
	if !ok {
		return time.Time{}, fmt.Errorf("expected string, got %T", v)
	}
	return time.Parse(time.DateOnly, s)
}

func getString(m map[string]any, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

func getInt(m map[string]any, key string) int {
	switch v := m[key].(type) {
	case int64:
		return int(v)
	case int:
		return v
	}
	return 0
}

func getBool(m map[string]any, key string) bool {
	if v, ok := m[key].(bool); ok {
		return v
	}
	return false
}

func extractStringSlice(raw any) []string {
	list, ok := raw.([]any)
	if !ok {
		return []string{}
	}
	result := make([]string, 0, len(list))
	for _, v := range list {
		if s, ok := v.(string); ok && strings.TrimSpace(s) != "" {
			result = append(result, s)
		}
	}
	return result
}
