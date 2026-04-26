package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"

	"graph-service/internal/handler"
	"graph-service/internal/service"
	"graph-service/internal/storage"
)

func main() {
	ctx := context.Background()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}

	neo4jURI := os.Getenv("NEO4J_URI")
	neo4jUser := os.Getenv("NEO4J_USER")
	neo4jPass := os.Getenv("NEO4J_PASS")
	postgresDSN := os.Getenv("POSTGRES_DSN")

	if neo4jURI == "" || postgresDSN == "" {
		log.Fatal("NEO4J_URI and POSTGRES_DSN environment variables are required")
	}

	neo4jStore, err := storage.NewNeo4jStore(ctx, neo4jURI, neo4jUser, neo4jPass)
	if err != nil {
		log.Fatalf("connect neo4j: %v", err)
	}
	defer neo4jStore.Close(ctx)

	pgStore, err := storage.NewPostgresStore(ctx, postgresDSN)
	if err != nil {
		log.Fatalf("connect postgres: %v", err)
	}
	defer pgStore.Close()

	graphService := service.NewGraphService(neo4jStore, pgStore)
	graphHandler := handler.NewGraphHandler(graphService)

	r := gin.Default()

	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "POST, GET, PATCH, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	})

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "service": "graph-service"})
	})

	api := r.Group("/api/graph")
	{
		api.POST("/plans", graphHandler.CreatePlan)
		api.GET("/plans/:id", graphHandler.GetPlan)
		api.PATCH("/plans/:id/tasks/:taskId", graphHandler.UpdateTask)
	}

	log.Printf("graph-service starting on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
