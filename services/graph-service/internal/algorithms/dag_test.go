package algorithms

import (
	"testing"
	"time"

	"graph-service/internal/models"
)

func TestTopologicalSort_Linear(t *testing.T) {
	tasks := []models.InputTask{
		{ID: "t3", Dependencies: []string{"t2"}},
		{ID: "t1", Dependencies: []string{}},
		{ID: "t2", Dependencies: []string{"t1"}},
	}
	order, err := TopologicalSort(tasks)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(order) != 3 {
		t.Fatalf("expected 3 tasks, got %d", len(order))
	}
	// t1 должна идти раньше t2, t2 раньше t3
	pos := func(id string) int {
		for i, v := range order {
			if v == id {
				return i
			}
		}
		return -1
	}
	if pos("t1") >= pos("t2") || pos("t2") >= pos("t3") {
		t.Errorf("wrong order: %v", order)
	}
}

func TestTopologicalSort_Cycle(t *testing.T) {
	tasks := []models.InputTask{
		{ID: "t1", Dependencies: []string{"t2"}},
		{ID: "t2", Dependencies: []string{"t1"}},
	}
	_, err := TopologicalSort(tasks)
	if err == nil {
		t.Fatal("expected cycle error, got nil")
	}
}

func TestComputeDates_NoDependencies(t *testing.T) {
	tasks := []models.InputTask{
		{ID: "t1", DurationDays: 5, Dependencies: []string{}},
	}
	order := []string{"t1"}
	start := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

	dates := ComputeDates(tasks, order, start)

	dr := dates["t1"]
	if dr == nil {
		t.Fatal("no date range for t1")
	}
	if !dr.Start.Equal(start) {
		t.Errorf("expected start %v, got %v", start, dr.Start)
	}
	expectedEnd := time.Date(2026, 1, 5, 0, 0, 0, 0, time.UTC)
	if !dr.End.Equal(expectedEnd) {
		t.Errorf("expected end %v, got %v", expectedEnd, dr.End)
	}
}

func TestComputeDates_Sequential(t *testing.T) {
	tasks := []models.InputTask{
		{ID: "t1", DurationDays: 3, Dependencies: []string{}},
		{ID: "t2", DurationDays: 2, Dependencies: []string{"t1"}},
	}
	order := []string{"t1", "t2"}
	start := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

	dates := ComputeDates(tasks, order, start)

	// t1: 1–3 Jan
	// t2: 4–5 Jan (начинается на следующий день после окончания t1)
	expectedT2Start := time.Date(2026, 1, 4, 0, 0, 0, 0, time.UTC)
	expectedT2End := time.Date(2026, 1, 5, 0, 0, 0, 0, time.UTC)

	if !dates["t2"].Start.Equal(expectedT2Start) {
		t.Errorf("t2 start: expected %v, got %v", expectedT2Start, dates["t2"].Start)
	}
	if !dates["t2"].End.Equal(expectedT2End) {
		t.Errorf("t2 end: expected %v, got %v", expectedT2End, dates["t2"].End)
	}
}

func TestComputeCPM_AllCritical(t *testing.T) {
	// Линейный граф — все задачи на критическом пути.
	tasks := []models.InputTask{
		{ID: "t1", DurationDays: 5, Dependencies: []string{}},
		{ID: "t2", DurationDays: 3, Dependencies: []string{"t1"}},
	}
	order := []string{"t1", "t2"}
	start := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	dates := ComputeDates(tasks, order, start)

	critical := ComputeCPM(tasks, order, dates)

	if !critical["t1"] || !critical["t2"] {
		t.Errorf("all tasks should be critical in linear chain, got: %v", critical)
	}
}

func TestComputeCPM_NonCritical(t *testing.T) {
	// t1(10d) → t3
	// t2(2d)  → t3
	// t3(5d)
	// t1 критический, t2 нет (он заканчивается раньше t1)
	tasks := []models.InputTask{
		{ID: "t1", DurationDays: 10, Dependencies: []string{}},
		{ID: "t2", DurationDays: 2, Dependencies: []string{}},
		{ID: "t3", DurationDays: 5, Dependencies: []string{"t1", "t2"}},
	}
	order, _ := TopologicalSort(tasks)
	start := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	dates := ComputeDates(tasks, order, start)
	critical := ComputeCPM(tasks, order, dates)

	if !critical["t1"] {
		t.Error("t1 should be critical")
	}
	if critical["t2"] {
		t.Error("t2 should NOT be critical")
	}
	if !critical["t3"] {
		t.Error("t3 should be critical")
	}
}
