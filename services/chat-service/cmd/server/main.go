// @title			Chat Service API
// @version		1.0
// @description	Сервис обработки сообщений пользователя и декомпозиции целей через LLM
// @host			localhost:8080
// @BasePath		/
// @securityDefinitions.apikey	BearerAuth
// @in							header
// @name						Authorization
package main

import (
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"

	_ "chat-service/docs"
	"chat-service/internal/handler"
	"chat-service/internal/llm"
	"chat-service/internal/middleware"
	"chat-service/internal/service"
)

func main() {
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		log.Fatal("OPENAI_API_KEY is not set — edit .env and restart")
	}
	if os.Getenv("JWT_SECRET") == "" {
		log.Fatal("JWT_SECRET environment variable is required")
	}

	model := os.Getenv("OPENAI_MODEL")
	if model == "" {
		model = "gpt-4o"
	}

	baseURL := os.Getenv("LLM_BASE_URL") // напр. https://openrouter.ai/api/v1/chat/completions

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	llmClient := llm.NewClient(apiKey, model, baseURL)
	chatService := service.NewChatService(llmClient)
	chatHandler := handler.NewChatHandler(chatService)

	r := gin.Default()

	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	})

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "service": "chat-service"})
	})

	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	api := r.Group("/api", middleware.RequireAuth())
	{
		api.POST("/chat", chatHandler.Handle)
	}

	log.Printf("chat-service starting on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
