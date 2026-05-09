package models

// RegisterRequest — тело POST /auth/register.
type RegisterRequest struct {
	Email    string `json:"email"    binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

// LoginRequest — тело POST /auth/login.
type LoginRequest struct {
	Email    string `json:"email"    binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// AuthResponse — ответ при успешной аутентификации.
type AuthResponse struct {
	Token string `json:"token"`
}
