package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"chat-service/internal/models"
)

const openAIURL = "https://api.openai.com/v1/chat/completions"

// openAIMessage — формат сообщения для OpenAI Chat API.
type openAIMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// openAIRequest — тело запроса к OpenAI.
type openAIRequest struct {
	Model          string          `json:"model"`
	Messages       []openAIMessage `json:"messages"`
	ResponseFormat responseFormat  `json:"response_format"`
	Temperature    float64         `json:"temperature"`
}

type responseFormat struct {
	Type string `json:"type"`
}

// openAIResponse — разбираем только нужные поля ответа.
type openAIResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

// llmResponse — внутренний формат ответа от модели.
type llmResponse struct {
	Type  string       `json:"type"`
	Reply string       `json:"reply"`
	Tasks []models.Task `json:"tasks"`
}

// Client — HTTP-клиент для OpenAI API.
type Client struct {
	apiKey     string
	model      string
	httpClient *http.Client
}

// NewClient создаёт клиент с указанным API-ключом и моделью.
func NewClient(apiKey, model string) *Client {
	return &Client{
		apiKey:     apiKey,
		model:      model,
		httpClient: &http.Client{},
	}
}

// Chat отправляет сообщение пользователя вместе с историей в OpenAI
// и возвращает текст ответа и опциональный план.
func (c *Client) Chat(ctx context.Context, history []models.HistoryMessage, userMessage string) (reply string, tasks []models.Task, err error) {
	messages := buildMessages(history, userMessage)

	reqBody := openAIRequest{
		Model:          c.model,
		Messages:       messages,
		ResponseFormat: responseFormat{Type: "json_object"},
		Temperature:    0.7,
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return "", nil, fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, openAIURL, bytes.NewReader(body))
	if err != nil {
		return "", nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", nil, fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", nil, fmt.Errorf("read response: %w", err)
	}

	var oaiResp openAIResponse
	if err := json.Unmarshal(raw, &oaiResp); err != nil {
		return "", nil, fmt.Errorf("unmarshal openai response: %w", err)
	}

	if oaiResp.Error != nil {
		return "", nil, fmt.Errorf("openai error: %s", oaiResp.Error.Message)
	}

	if len(oaiResp.Choices) == 0 {
		return "", nil, fmt.Errorf("no choices in openai response")
	}

	content := oaiResp.Choices[0].Message.Content

	var llmResp llmResponse
	if err := json.Unmarshal([]byte(content), &llmResp); err != nil {
		// Модель вернула невалидный JSON — возвращаем content как текст.
		return content, nil, nil
	}

	if llmResp.Type == "plan" {
		return llmResp.Reply, llmResp.Tasks, nil
	}

	return llmResp.Reply, nil, nil
}

// buildMessages собирает массив сообщений для OpenAI из истории и нового сообщения.
func buildMessages(history []models.HistoryMessage, userMessage string) []openAIMessage {
	messages := make([]openAIMessage, 0, len(history)+2)
	messages = append(messages, openAIMessage{Role: "system", Content: SystemPrompt})

	for _, h := range history {
		messages = append(messages, openAIMessage{Role: h.Role, Content: h.Content})
	}

	messages = append(messages, openAIMessage{Role: "user", Content: userMessage})
	return messages
}
