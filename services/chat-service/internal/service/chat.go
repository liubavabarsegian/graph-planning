package service

import (
	"context"

	"chat-service/internal/llm"
	"chat-service/internal/models"
)

// ChatService — бизнес-логика чата.
type ChatService struct {
	llmClient *llm.Client
}

// NewChatService создаёт сервис с указанным LLM-клиентом.
func NewChatService(llmClient *llm.Client) *ChatService {
	return &ChatService{llmClient: llmClient}
}

// ProcessMessage отправляет сообщение в LLM и возвращает ответ.
func (s *ChatService) ProcessMessage(ctx context.Context, req models.ChatRequest) (models.ChatResponse, error) {
	reply, tasks, err := s.llmClient.Chat(ctx, req.History, req.Message)
	if err != nil {
		return models.ChatResponse{}, err
	}

	resp := models.ChatResponse{Reply: reply}

	if len(tasks) > 0 {
		resp.Plan = &models.Plan{Tasks: tasks}
	}

	return resp, nil
}
