package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"

	"chat-service/internal/handler"
	"chat-service/internal/llm"
	"chat-service/internal/service"
)

func main() {
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		log.Fatal("OPENAI_API_KEY environment variable is required")
	}

	model := os.Getenv("OPENAI_MODEL")
	if model == "" {
		model = "gpt-4o"
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	llmClient := llm.NewClient(apiKey, model)
	chatService := service.NewChatService(llmClient)
	chatHandler := handler.NewChatHandler(chatService)

	r := gin.Default()

	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	r.POST("/api/chat", chatHandler.Handle)

	log.Printf("chat-service starting on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
