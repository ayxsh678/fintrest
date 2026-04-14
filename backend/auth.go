package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

var jwtSecret []byte

func initJWTSecret() {
	s := os.Getenv("JWT_SECRET")
	if s == "" {
		log.Fatal("FATAL: JWT_SECRET environment variable is not set. Refusing to start.")
	}
	jwtSecret = []byte(s)
}

type Claims struct {
	UserID int    `json:"user_id"`
	Email  string `json:"email"`
	jwt.RegisteredClaims
}

func handleRegister(c *gin.Context) {
	var req struct {
		Email    string `json:"email" binding:"required,email"`
		Password string `json:"password" binding:"required,min=6"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	var userID int
	err = DB.QueryRow(
		`INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id`,
		req.Email, string(hash),
	).Scan(&userID)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") || strings.Contains(err.Error(), "unique constraint") {
			c.JSON(http.StatusConflict, gin.H{"error": "Email already registered"})
			return
		}
		log.Printf("ERROR: register DB insert failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Registration failed"})
		return
	}

	token, err := generateToken(userID, req.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	log.Printf("[register] New user registered: %s (id=%d)", req.Email, userID)
	c.JSON(http.StatusCreated, gin.H{"token": token, "email": req.Email, "user_id": userID})
}

// dummyHash is used to normalize bcrypt timing when user is not found,
// preventing timing-based email enumeration attacks.
var dummyHash, _ = bcrypt.GenerateFromPassword([]byte("dummy-timing-prevention"), bcrypt.DefaultCost)

func handleLogin(c *gin.Context) {
	var req struct {
		Email    string `json:"email" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var userID int
	var hash string
	userFound := true

	err := DB.QueryRow(
		`SELECT id, password FROM users WHERE email = $1`, req.Email,
	).Scan(&userID, &hash)
	if err != nil {
		userFound = false
		hash = string(dummyHash) // always run bcrypt to prevent timing attack
	}

	// Always run bcrypt regardless of whether user was found
	bcryptErr := bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password))

	if !userFound || bcryptErr != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	token, err := generateToken(userID, req.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"token": token, "email": req.Email, "user_id": userID})
}

func generateToken(userID int, email string) (string, error) {
	claims := Claims{
		UserID: userID,
		Email:  email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(jwtSecret)
}

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" || !strings.HasPrefix(header, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Missing or malformed token"})
			return
		}

		tokenStr := strings.TrimPrefix(header, "Bearer ")
		claims := &Claims{}

		token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
			// Explicitly validate signing method to prevent "alg:none" attacks
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
			}
			return jwtSecret, nil
		})

		if err != nil || token == nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			return
		}

		c.Set("user_id", claims.UserID)
		c.Set("email", claims.Email)
		c.Next()
	}
}