.PHONY: help up down build logs ps \
        test test-auth test-chat test-graph \
        swag swag-auth swag-chat swag-graph \
        env clean

# ─── конфигурация ─────────────────────────────────────────────────────────────

COMPOSE         := docker compose
SERVICES_DIR    := ./services
AUTH_DIR        := $(SERVICES_DIR)/auth-service
CHAT_DIR        := $(SERVICES_DIR)/chat-service
GRAPH_DIR       := $(SERVICES_DIR)/graph-service

# ─── помощь ───────────────────────────────────────────────────────────────────

help: ## Показать список доступных команд
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ─── окружение ────────────────────────────────────────────────────────────────

env: ## Создать .env из .env.example (если .env ещё не существует)
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "  .env создан из .env.example — задайте OPENAI_API_KEY и JWT_SECRET"; \
	else \
		echo "  .env уже существует, пропускаем"; \
	fi

# ─── docker compose ───────────────────────────────────────────────────────────

up: env ## Собрать образы и запустить весь стек
	$(COMPOSE) up --build -d

up-logs: env ## Собрать образы, запустить и следить за логами
	$(COMPOSE) up --build

down: ## Остановить и удалить контейнеры (данные сохраняются)
	$(COMPOSE) down

down-volumes: ## Остановить контейнеры и удалить все тома (данные будут утеряны!)
	$(COMPOSE) down -v

build: ## Пересобрать Docker-образы без запуска
	$(COMPOSE) build

logs: ## Следить за логами всех сервисов (Ctrl+C для выхода)
	$(COMPOSE) logs -f

ps: ## Показать статус контейнеров
	$(COMPOSE) ps

restart: ## Перезапустить все контейнеры
	$(COMPOSE) restart

# ─── тесты ────────────────────────────────────────────────────────────────────

test: test-graph ## Запустить все тесты (go test)

test-graph: ## Запустить тесты graph-service
	@echo "  graph-service:"
	cd $(GRAPH_DIR) && go test ./... -v

test-auth: ## Запустить тесты auth-service
	@echo "  auth-service:"
	cd $(AUTH_DIR) && go test ./... -v

test-chat: ## Запустить тесты chat-service
	@echo "  chat-service:"
	cd $(CHAT_DIR) && go test ./... -v

# ─── swagger ──────────────────────────────────────────────────────────────────

swag: swag-auth swag-chat swag-graph ## Перегенерировать Swagger-документацию для всех сервисов

swag-auth: ## Swagger для auth-service
	cd $(AUTH_DIR) && swag init -g cmd/server/main.go -o docs

swag-chat: ## Swagger для chat-service
	cd $(CHAT_DIR) && swag init -g cmd/server/main.go -o docs

swag-graph: ## Swagger для graph-service
	cd $(GRAPH_DIR) && swag init -g cmd/server/main.go -o docs

# ─── сборка бинарей локально (без Docker) ────────────────────────────────────

build-local: ## Собрать бинарные файлы всех Go-сервисов локально
	cd $(AUTH_DIR)  && go build -o bin/auth-service  ./cmd/server
	cd $(CHAT_DIR)  && go build -o bin/chat-service  ./cmd/server
	cd $(GRAPH_DIR) && go build -o bin/graph-service ./cmd/server
	@echo "  бинарные файлы находятся в services/*/bin/"

# ─── очистка ──────────────────────────────────────────────────────────────────

clean: ## Удалить скомпилированные бинарные файлы
	rm -f $(AUTH_DIR)/bin/auth-service \
	      $(CHAT_DIR)/bin/chat-service \
	      $(GRAPH_DIR)/bin/graph-service
