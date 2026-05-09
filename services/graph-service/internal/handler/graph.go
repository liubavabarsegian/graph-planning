package handler

import (
	"net/http"
	"strings"
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

// CreatePlan godoc
//
//	@Summary		Создать план из списка задач
//	@Tags			graph
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			body	body		models.CreatePlanRequest	true	"Список задач и дата начала"
//	@Success		201		{object}	models.GraphResponse
//	@Failure		400		{object}	map[string]string
//	@Failure		401		{object}	map[string]string
//	@Failure		422		{object}	map[string]string
//	@Router			/api/graph/plans [post]
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

	userID, _ := c.Get("userID")
	resp, err := h.svc.CreatePlan(c.Request.Context(), userID.(string), req.Tasks, startDate)
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

// GetPlan godoc
//
//	@Summary		Получить план по ID
//	@Tags			graph
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id	path		string	true	"Plan ID"
//	@Success		200	{object}	models.GraphResponse
//	@Failure		401	{object}	map[string]string
//	@Failure		404	{object}	map[string]string
//	@Router			/api/graph/plans/{id} [get]
func (h *GraphHandler) GetPlan(c *gin.Context) {
	planID := c.Param("id")
	if planID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "plan id is required"})
		return
	}

	userID, _ := c.Get("userID")
	resp, err := h.svc.GetPlan(c.Request.Context(), userID.(string), planID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// UpdateTask godoc
//
//	@Summary		Обновить задачу и пересчитать граф
//	@Tags			graph
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id		path		string						true	"Plan ID"
//	@Param			taskId	path		string						true	"Task ID"
//	@Param			body	body		models.UpdateTaskRequest	true	"Обновляемые поля задачи"
//	@Success		200		{object}	models.UpdateTaskResponse
//	@Failure		400		{object}	map[string]string
//	@Failure		401		{object}	map[string]string
//	@Failure		422		{object}	map[string]string
//	@Router			/api/graph/plans/{id}/tasks/{taskId} [patch]
func (h *GraphHandler) UpdateTask(c *gin.Context) {
	planID := c.Param("id")
	taskID := c.Param("taskId")

	var req models.UpdateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, _ := c.Get("userID")
	resp, err := h.svc.UpdateTask(c.Request.Context(), userID.(string), planID, taskID, req)
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
	return strings.Contains(msg, "cycle detected") ||
		strings.Contains(msg, "invalid graph") ||
		strings.Contains(msg, "not found")
}
