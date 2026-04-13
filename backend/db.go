package main

import (
	"database/sql"
	"log"
	"os"
	"time"

	_ "github.com/lib/pq"
)

var DB *sql.DB

func InitDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL not set")
	}

	var err error
	DB, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Fatalf("Failed to open DB: %v", err)
	}

	if err = DB.Ping(); err != nil {
		log.Fatalf("Failed to connect to DB: %v", err)
	}

	DB.SetMaxOpenConns(25)
	DB.SetMaxIdleConns(5)
	DB.SetConnMaxLifetime(5 * time.Minute)

	createTables()
	log.Println("✅ Database connected")
}

func createTables() {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id         SERIAL PRIMARY KEY,
			email      TEXT UNIQUE NOT NULL,
			password   TEXT NOT NULL,
			created_at TIMESTAMP DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS watchlist (
			id         SERIAL PRIMARY KEY,
			user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
			ticker     TEXT NOT NULL,
			added_at   TIMESTAMP DEFAULT NOW(),
			UNIQUE(user_id, ticker)
		)`,
	}

	for _, q := range queries {
		if _, err := DB.Exec(q); err != nil {
			log.Fatalf("Failed to create table: %v\nQuery: %s", err, q)
		}
	}
}
