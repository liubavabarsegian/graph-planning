package algorithms

import (
	"fmt"
	"time"

	"graph-service/internal/models"
)

// TopologicalSort выполняет топологическую сортировку алгоритмом Кана.
// Возвращает упорядоченный срез ID задач или ошибку при обнаружении цикла.
func TopologicalSort(tasks []models.InputTask) ([]string, error) {
	inDegree := make(map[string]int, len(tasks))
	adj := make(map[string][]string, len(tasks)) // from → []to (кто зависит от from)

	for _, t := range tasks {
		if _, ok := inDegree[t.ID]; !ok {
			inDegree[t.ID] = 0
		}
		for _, dep := range t.Dependencies {
			adj[dep] = append(adj[dep], t.ID)
			inDegree[t.ID]++
		}
	}

	queue := make([]string, 0, len(tasks))
	for id, deg := range inDegree {
		if deg == 0 {
			queue = append(queue, id)
		}
	}

	order := make([]string, 0, len(tasks))
	for len(queue) > 0 {
		cur := queue[0]
		queue = queue[1:]
		order = append(order, cur)
		for _, next := range adj[cur] {
			inDegree[next]--
			if inDegree[next] == 0 {
				queue = append(queue, next)
			}
		}
	}

	if len(order) != len(tasks) {
		return nil, fmt.Errorf("cycle detected in dependency graph")
	}

	return order, nil
}

// ComputeDates вычисляет start_date и end_date для каждой задачи
// методом прямого прохода (forward pass) в топологическом порядке.
// startDate — дата начала плана (обычно сегодня).
func ComputeDates(tasks []models.InputTask, order []string, startDate time.Time) map[string]*dateRange {
	// нормализуем до начала дня
	start := truncateToDay(startDate)

	byID := indexByID(tasks)
	dates := make(map[string]*dateRange, len(tasks))

	for _, id := range order {
		t := byID[id]
		taskStart := start

		for _, depID := range t.Dependencies {
			if dr, ok := dates[depID]; ok {
				// задача может начаться только на следующий день после окончания зависимости
				candidate := dr.End.AddDate(0, 0, 1)
				if candidate.After(taskStart) {
					taskStart = candidate
				}
			}
		}

		taskEnd := taskStart.AddDate(0, 0, t.DurationDays-1)
		dates[id] = &dateRange{Start: taskStart, End: taskEnd}
	}

	return dates
}

// ComputeCPM вычисляет критический путь методом CPM (forward + backward pass).
// Возвращает множество ID задач, лежащих на критическом пути.
func ComputeCPM(tasks []models.InputTask, order []string, dates map[string]*dateRange) map[string]bool {
	byID := indexByID(tasks)

	// ES / EF уже в dates (из forward pass).
	// Backward pass: LF / LS.
	lf := make(map[string]time.Time, len(tasks))
	ls := make(map[string]time.Time, len(tasks))

	// Находим максимальный EF по всем задачам (конец проекта).
	projectEnd := time.Time{}
	for _, dr := range dates {
		if dr.End.After(projectEnd) {
			projectEnd = dr.End
		}
	}

	// Инициализируем LF = projectEnd для всех задач, у которых нет последователей.
	successors := buildSuccessors(tasks)
	for _, t := range tasks {
		if len(successors[t.ID]) == 0 {
			lf[t.ID] = projectEnd
		}
	}

	// Backward pass — идём в обратном топологическом порядке.
	for i := len(order) - 1; i >= 0; i-- {
		id := order[i]
		t := byID[id]

		// LF = min(LS всех последователей) - 1 день
		for _, succID := range successors[id] {
			if lsSucc, ok := ls[succID]; ok {
				candidate := lsSucc.AddDate(0, 0, -1)
				if lf[id].IsZero() || candidate.Before(lf[id]) {
					lf[id] = candidate
				}
			}
		}
		if lf[id].IsZero() {
			lf[id] = projectEnd
		}

		ls[id] = lf[id].AddDate(0, 0, -(t.DurationDays - 1))
	}

	// float = LS - ES; задача критическая если float == 0.
	critical := make(map[string]bool, len(tasks))
	for _, t := range tasks {
		es := dates[t.ID].Start
		lsVal := ls[t.ID]
		floatDays := int(lsVal.Sub(es).Hours() / 24)
		critical[t.ID] = floatDays == 0
	}

	return critical
}

// BuildGraphNodes собирает итоговый список GraphNode с датами и флагами CPM.
func BuildGraphNodes(tasks []models.InputTask, dates map[string]*dateRange, critical map[string]bool) []models.GraphNode {
	nodes := make([]models.GraphNode, 0, len(tasks))
	for _, t := range tasks {
		dr := dates[t.ID]
		status := t.Status
		if status == "" {
			status = "todo"
		}
		nodes = append(nodes, models.GraphNode{
			ID:           t.ID,
			Title:        t.Title,
			Description:  t.Description,
			DurationDays: t.DurationDays,
			StartDate:    models.DateOnly{Time: dr.Start},
			EndDate:      models.DateOnly{Time: dr.End},
			IsCritical:   critical[t.ID],
			Dependencies: t.Dependencies,
			Status:       status,
		})
	}
	return nodes
}

// BuildGraphEdges строит список рёбер из списка задач.
func BuildGraphEdges(tasks []models.InputTask) []models.GraphEdge {
	edges := make([]models.GraphEdge, 0)
	for _, t := range tasks {
		for _, dep := range t.Dependencies {
			edges = append(edges, models.GraphEdge{From: dep, To: t.ID})
		}
	}
	return edges
}

// --- helpers ---

type dateRange struct {
	Start time.Time
	End   time.Time
}

func truncateToDay(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
}

func indexByID(tasks []models.InputTask) map[string]models.InputTask {
	m := make(map[string]models.InputTask, len(tasks))
	for _, t := range tasks {
		m[t.ID] = t
	}
	return m
}

func buildSuccessors(tasks []models.InputTask) map[string][]string {
	succ := make(map[string][]string, len(tasks))
	for _, t := range tasks {
		for _, dep := range t.Dependencies {
			succ[dep] = append(succ[dep], t.ID)
		}
	}
	return succ
}
