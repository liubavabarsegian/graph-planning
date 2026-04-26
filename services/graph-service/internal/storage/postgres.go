package storage

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// PlanMeta — метаданные плана в PostgreSQL.
type PlanMeta struct {
	ID        string
	StartDate time.Time
	CreatedAt time.Time
}

// PostgresStore работает с метаданными планов.
type PostgresStore struct {
	pool *pgxpool.Pool
}

// NewPostgresStore подключается к PostgreSQL и создаёт таблицы при необходимости.
func NewPostgresStore(ctx context.Context, dsn string) (*PostgresStore, error) {
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, fmt.Errorf("connect postgres: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("ping postgres: %w", err)
	}

	s := &PostgresStore{pool: pool}
	if err := s.migrate(ctx); err != nil {
		return nil, fmt.Errorf("migrate postgres: %w", err)
	}

	return s, nil
}

func (s *PostgresStore) migrate(ctx context.Context) error {
	_, err := s.pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS plans (
			id         TEXT PRIMARY KEY,
			start_date DATE NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)
	return err
}

// SavePlan сохраняет метаданные нового плана.
func (s *PostgresStore) SavePlan(ctx context.Context, id string, startDate time.Time) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO plans (id, start_date) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		id, startDate,
	)
	return err
}

// GetPlan возвращает метаданные плана по ID.
func (s *PostgresStore) GetPlan(ctx context.Context, id string) (*PlanMeta, error) {
	row := s.pool.QueryRow(ctx,
		`SELECT id, start_date, created_at FROM plans WHERE id = $1`, id,
	)
	var m PlanMeta
	if err := row.Scan(&m.ID, &m.StartDate, &m.CreatedAt); err != nil {
		return nil, fmt.Errorf("get plan: %w", err)
	}
	return &m, nil
}

// Close закрывает пул соединений.
func (s *PostgresStore) Close() {
	s.pool.Close()
}
