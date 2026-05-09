package handler

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"auth-service/internal/models"
	"auth-service/internal/service"
)

// AuthHandler — HTTP-хендлеры для аутентификации.
type AuthHandler struct {
	svc *service.AuthService
}

// NewAuthHandler создаёт хендлер.
func NewAuthHandler(svc *service.AuthService) *AuthHandler {
	return &AuthHandler{svc: svc}
}

// Register godoc
//
//	@Summary		Регистрация нового пользователя
//	@Tags			auth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		models.RegisterRequest	true	"Email и пароль"
//	@Success		201		{object}	models.AuthResponse
//	@Failure		400		{object}	map[string]string
//	@Failure		409		{object}	map[string]string
//	@Router			/auth/register [post]
func (h *AuthHandler) Register(c *gin.Context) {
	var req models.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	resp, err := h.svc.Register(c.Request.Context(), req)
	if err != nil {
		status := http.StatusInternalServerError
		if strings.Contains(err.Error(), "already registered") {
			status = http.StatusConflict
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, resp)
}

// Login godoc
//
//	@Summary		Вход в систему
//	@Tags			auth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		models.LoginRequest	true	"Email и пароль"
//	@Success		200		{object}	models.AuthResponse
//	@Failure		400		{object}	map[string]string
//	@Failure		401		{object}	map[string]string
//	@Router			/auth/login [post]
func (h *AuthHandler) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	resp, err := h.svc.Login(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}
