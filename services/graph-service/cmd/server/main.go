// @title			Graph Service API
// @version		1.0
// @description	Сервис построения и управления графом зависимостей задач (DAG + CPM)
// @host			localhost:8081
// @BasePath		/
// @securityDefinitions.apikey	BearerAuth
// @in							header
// @name						Authorization
package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"

	_ "graph-service/docs"
	"graph-service/internal/handler"
	"graph-service/internal/middleware"
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
	if os.Getenv("JWT_SECRET") == "" {
		log.Fatal("JWT_SECRET environment variable is required")
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
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	})

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "service": "graph-service"})
	})

	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	api := r.Group("/api/graph", middleware.RequireAuth())
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
