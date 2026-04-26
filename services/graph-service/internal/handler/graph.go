package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"graph-service/internal/models"
	"graph-service/internal/service"
)

// GraphHandler — HTTP-хендлеры для графа.
type GraphHandler struct {
	svc *service.GraphService
}

// NewGraphHandler создаёт хендлер.
func NewGraphHandler(svc *service.GraphService) *GraphHandler {
	return &GraphHandler{svc: svc}
}

// CreatePlan обрабатывает POST /api/graph/plans.
func (h *GraphHandler) CreatePlan(c *gin.Context) {
	var req models.CreatePlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	startDate := time.Now()
	if req.StartDate != "" {
		parsed, err := time.Parse(time.DateOnly, req.StartDate)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid start_date format, use YYYY-MM-DD"})
			return
		}
		startDate = parsed
	}

	resp, err := h.svc.CreatePlan(c.Request.Context(), req.Tasks, startDate)
	if err != nil {
		status := http.StatusInternalServerError
		if isClientError(err) {
			status = http.StatusUnprocessableEntity
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, resp)
}

// GetPlan обрабатывает GET /api/graph/plans/:id.
func (h *GraphHandler) GetPlan(c *gin.Context) {
	planID := c.Param("id")
	if planID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "plan id is required"})
		return
	}

	resp, err := h.svc.GetPlan(c.Request.Context(), planID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// UpdateTask обрабатывает PATCH /api/graph/plans/:id/tasks/:taskId.
func (h *GraphHandler) UpdateTask(c *gin.Context) {
	planID := c.Param("id")
	taskID := c.Param("taskId")

	var req models.UpdateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	resp, err := h.svc.UpdateTask(c.Request.Context(), planID, taskID, req)
	if err != nil {
		status := http.StatusInternalServerError
		if isClientError(err) {
			status = http.StatusUnprocessableEntity
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func isClientError(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return contains(msg, "cycle detected") || contains(msg, "invalid graph") || contains(msg, "not found")
}

func contains(s, sub string) bool {
	return len(s) >= len(sub) && (s == sub || len(s) > 0 && containsStr(s, sub))
}

func containsStr(s, sub string) bool {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
