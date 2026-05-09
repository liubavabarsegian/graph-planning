package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"chat-service/internal/models"
	"chat-service/internal/service"
)

// ChatHandler — HTTP-хендлер для чата.
type ChatHandler struct {
	svc *service.ChatService
}

// NewChatHandler создаёт хендлер.
func NewChatHandler(svc *service.ChatService) *ChatHandler {
	return &ChatHandler{svc: svc}
}

// Handle godoc
//
//	@Summary		Отправить сообщение и получить план задач
//	@Tags			chat
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			body	body		models.ChatRequest	true	"Сообщение и история диалога"
//	@Success		200		{object}	models.ChatResponse
//	@Failure		400		{object}	map[string]string
//	@Failure		401		{object}	map[string]string
//	@Failure		500		{object}	map[string]string
//	@Router			/api/chat [post]
func (h *ChatHandler) Handle(c *gin.Context) {
	var req models.ChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	resp, err := h.svc.ProcessMessage(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process message. Please try again."})
		return
	}

	c.JSON(http.StatusOK, resp)
}
