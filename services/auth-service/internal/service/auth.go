package service

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"auth-service/internal/models"
	"auth-service/internal/storage"
)

// AuthService реализует бизнес-логику аутентификации.
type AuthService struct {
	store *storage.PostgresStore
}

// NewAuthService создаёт сервис.
func NewAuthService(store *storage.PostgresStore) *AuthService {
	return &AuthService{store: store}
}

// Register регистрирует нового пользователя и возвращает JWT.
func (s *AuthService) Register(ctx context.Context, req models.RegisterRequest) (*models.AuthResponse, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}

	user, err := s.store.CreateUser(ctx, req.Email, string(hash))
	if err != nil {
		return nil, fmt.Errorf("email already registered")
	}

	token, err := generateJWT(user.ID)
	if err != nil {
		return nil, err
	}

	return &models.AuthResponse{Token: token}, nil
}

// Login проверяет credentials и возвращает JWT.
func (s *AuthService) Login(ctx context.Context, req models.LoginRequest) (*models.AuthResponse, error) {
	user, err := s.store.GetUserByEmail(ctx, req.Email)
	if err != nil {
		return nil, fmt.Errorf("invalid email or password")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, fmt.Errorf("invalid email or password")
	}

	token, err := generateJWT(user.ID)
	if err != nil {
		return nil, err
	}

	return &models.AuthResponse{Token: token}, nil
}

// generateJWT создаёт подписанный JWT с user ID в sub-claim.
func generateJWT(userID string) (string, error) {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		return "", fmt.Errorf("JWT_SECRET not set")
	}

	claims := jwt.RegisteredClaims{
		Subject:   userID,
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(30 * 24 * time.Hour)),
		IssuedAt:  jwt.NewNumericDate(time.Now()),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}
