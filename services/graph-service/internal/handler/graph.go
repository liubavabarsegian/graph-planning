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

// ListPlans godoc
//
//	@Summary		Список планов пользователя
//	@Tags			graph
//	@Produce		json
//	@Security		BearerAuth
//	@Success		200	{array}		models.PlanSummary
//	@Failure		401	{object}	map[string]string
//	@Router			/api/graph/plans [get]
func (h *GraphHandler) ListPlans(c *gin.Context) {
	userID, _ := c.Get("userID")
	plans, err := h.svc.ListUserPlans(c.Request.Context(), userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if plans == nil {
		plans = []models.PlanSummary{}
	}
	c.JSON(http.StatusOK, plans)
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
	resp, err := h.svc.CreatePlan(c.Request.Context(), userID.(string), req.Title, req.Tasks, startDate)
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

// DeletePlan godoc
//
//	@Summary		Удалить план
//	@Tags			graph
//	@Security		BearerAuth
//	@Param			id	path	string	true	"Plan ID"
//	@Success		204	"No Content"
//	@Failure		401	{object}	map[string]string
//	@Failure		404	{object}	map[string]string
//	@Router			/api/graph/plans/{id} [delete]
func (h *GraphHandler) DeletePlan(c *gin.Context) {
	planID := c.Param("id")
	userID, _ := c.Get("userID")

	if err := h.svc.DeletePlan(c.Request.Context(), userID.(string), planID); err != nil {
		status := http.StatusInternalServerError
		if isClientError(err) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
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

// SetTaskStatus godoc
//
//	@Summary		Обновить статус задачи (todo/in_progress/done)
//	@Tags			graph
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id		path		string							true	"Plan ID"
//	@Param			taskId	path		string							true	"Task ID"
//	@Param			body	body		models.SetTaskStatusRequest		true	"Новый статус"
//	@Success		204		"No Content"
//	@Failure		400		{object}	map[string]string
//	@Failure		401		{object}	map[string]string
//	@Failure		404		{object}	map[string]string
//	@Router			/api/graph/plans/{id}/tasks/{taskId}/status [patch]
func (h *GraphHandler) SetTaskStatus(c *gin.Context) {
	planID := c.Param("id")
	taskID := c.Param("taskId")

	var req models.SetTaskStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, _ := c.Get("userID")
	if err := h.svc.SetTaskStatus(c.Request.Context(), userID.(string), planID, taskID, req.Status); err != nil {
		status := http.StatusInternalServerError
		if isClientError(err) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}

// AddTask godoc
//
//	@Summary		Добавить задачу в план
//	@Tags			graph
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id		path		string					true	"Plan ID"
//	@Param			body	body		models.AddTaskRequest	true	"Новая задача"
//	@Success		200		{object}	models.UpdateTaskResponse
//	@Failure		400		{object}	map[string]string
//	@Failure		401		{object}	map[string]string
//	@Failure		422		{object}	map[string]string
//	@Router			/api/graph/plans/{id}/tasks [post]
func (h *GraphHandler) AddTask(c *gin.Context) {
	planID := c.Param("id")

	var req models.AddTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, _ := c.Get("userID")
	resp, err := h.svc.AddTask(c.Request.Context(), userID.(string), planID, req)
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

// DeleteTask godoc
//
//	@Summary		Удалить задачу из плана
//	@Tags			graph
//	@Security		BearerAuth
//	@Param			id		path	string	true	"Plan ID"
//	@Param			taskId	path	string	true	"Task ID"
//	@Success		200		{object}	models.UpdateTaskResponse
//	@Failure		401		{object}	map[string]string
//	@Failure		404		{object}	map[string]string
//	@Router			/api/graph/plans/{id}/tasks/{taskId} [delete]
func (h *GraphHandler) DeleteTask(c *gin.Context) {
	planID := c.Param("id")
	taskID := c.Param("taskId")

	userID, _ := c.Get("userID")
	resp, err := h.svc.DeleteTask(c.Request.Context(), userID.(string), planID, taskID)
	if err != nil {
		status := http.StatusInternalServerError
		if isClientError(err) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// AddSubtask godoc
//
//	@Summary		Добавить подзадачу к задаче
//	@Tags			graph
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id		path		string						true	"Plan ID"
//	@Param			taskId	path		string						true	"Task ID"
//	@Param			body	body		models.AddSubtaskRequest	true	"Заголовок подзадачи"
//	@Success		200		{object}	models.GraphNode
//	@Failure		400		{object}	map[string]string
//	@Failure		401		{object}	map[string]string
//	@Failure		404		{object}	map[string]string
//	@Router			/api/graph/plans/{id}/tasks/{taskId}/subtasks [post]
func (h *GraphHandler) AddSubtask(c *gin.Context) {
	planID := c.Param("id")
	taskID := c.Param("taskId")

	var req models.AddSubtaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, _ := c.Get("userID")
	node, err := h.svc.AddSubtask(c.Request.Context(), userID.(string), planID, taskID, req.Title)
	if err != nil {
		status := http.StatusInternalServerError
		if isClientError(err) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, node)
}

// UpdateSubtask godoc
//
//	@Summary		Переключить done у подзадачи (с автообновлением статуса задачи)
//	@Tags			graph
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id			path		string							true	"Plan ID"
//	@Param			taskId		path		string							true	"Task ID"
//	@Param			subtaskId	path		string							true	"Subtask ID"
//	@Param			body		body		models.UpdateSubtaskRequest		true	"done flag"
//	@Success		200			{object}	models.GraphNode
//	@Failure		400			{object}	map[string]string
//	@Failure		401			{object}	map[string]string
//	@Failure		404			{object}	map[string]string
//	@Router			/api/graph/plans/{id}/tasks/{taskId}/subtasks/{subtaskId} [patch]
func (h *GraphHandler) UpdateSubtask(c *gin.Context) {
	planID := c.Param("id")
	taskID := c.Param("taskId")
	subtaskID := c.Param("subtaskId")

	var req models.UpdateSubtaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, _ := c.Get("userID")
	node, err := h.svc.UpdateSubtask(c.Request.Context(), userID.(string), planID, taskID, subtaskID, req.Done)
	if err != nil {
		status := http.StatusInternalServerError
		if isClientError(err) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, node)
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
