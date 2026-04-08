package main

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// ── Models ─────────────────────────────────────────────

type QueryRequest struct {
	Question       string `json:"question" binding:"required"`
	IncludeSources bool   `json:"include_sources"`
	SessionID      string `json:"session_id"`
	TimeRange      string `json:"time_range"`
}

type QueryResponse struct {
	Answer       string   `json:"answer"`
	ContextUsed  string   `json:"context_used"`
	ResponseTime float64  `json:"response_time"`
	Sources      []string `json:"sources"`
	SessionID    string   `json:"session_id"`
}

// ── Global config ──────────────────────────────────────

var httpClient = &http.Client{
	Timeout: 30 * time.Second,
}

func pythonURL() string {
	url := os.Getenv("PYTHON_SERVICE_URL")
	if url == "" {
		return "http://localhost:8001"
	}
	return strings.TrimSuffix(url, "/")
}

// ── Helpers ────────────────────────────────────────────

func buildContext(question, timeRange string) string {
	payload, err := json.Marshal(map[string]string{
		"question":   question,
		"time_range": timeRange,
	})
	if err != nil {
		return "System: Failed to encode request."
	}
	resp, err := httpClient.Post(
		pythonURL()+"/context", "application/json", bytes.NewBuffer(payload),
	)
	if err != nil {
		return "System: Retrieval service currently unavailable."
	}
	defer resp.Body.Close()

	var result struct {
		Context string `json:"context"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return ""
	}
	return result.Context
}

func generateResponse(question, context, sessionID string) (string, string) {
	payload, err := json.Marshal(map[string]string{
		"question":   question,
		"context":    context,
		"session_id": sessionID,
	})
	if err != nil {
		return "System: Failed to encode request.", sessionID
	}
	resp, err := httpClient.Post(
		pythonURL()+"/generate", "application/json", bytes.NewBuffer(payload),
	)
	if err != nil {
		return "System: Inference engine currently unavailable.", sessionID
	}
	defer resp.Body.Close()

	var result struct {
		Answer    string `json:"answer"`
		SessionID string `json:"session_id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "Error decoding AI response.", sessionID
	}
	return result.Answer, result.SessionID
}

func getStockData(ticker string) interface{} {
	resp, err := httpClient.Get(pythonURL() + "/stock/" + ticker)
	if err != nil {
		return gin.H{"error": "Stock service unavailable"}
	}
	defer resp.Body.Close()

	var result interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	return result
}

func detectSources(context string) []string {
	sources := []string{}
	if strings.Contains(context, "TakeToday") {
		sources = append(sources, "TakeToday (verified)")
	}
	if strings.Contains(context, "Stock:") {
		sources = append(sources, "Yahoo Finance (real-time)")
	}
	if strings.Contains(context, "Recent Financial News:") {
		sources = append(sources, "NewsAPI")
	}
	if strings.Contains(context, "Earnings Schedule") {
		sources = append(sources, "Yahoo Finance (earnings)")
	}
	return sources
}

func analyzePortfolio(tickers []string, sessionID string) (map[string]interface{}, error) {
	payload, err := json.Marshal(map[string]interface{}{
		"tickers":    tickers,
		"session_id": sessionID,
	})
	if err != nil {
		return nil, err
	}
	resp, err := httpClient.Post(
		pythonURL()+"/portfolio", "application/json", bytes.NewBuffer(payload),
	)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}

func portfolioFromChat(query, sessionID string) (map[string]interface{}, error) {
	payload, err := json.Marshal(map[string]string{
		"query":      query,
		"session_id": sessionID,
	})
	if err != nil {
		return nil, err
	}
	resp, err := httpClient.Post(
		pythonURL()+"/portfolio/from-chat", "application/json", bytes.NewBuffer(payload),
	)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}

// ── Main ───────────────────────────────────────────────

func main() {
	r := gin.Default()

	allowedOrigin := os.Getenv("ALLOWED_ORIGIN")
	if allowedOrigin == "" {
		allowedOrigin = "http://localhost:5173"
	}

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{allowedOrigin, "http://localhost:3000"},
		AllowMethods:     []string{"GET", "POST", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
	}))

	// ── Health ───────────────────────────────────────────
	r.GET("/", func(c *gin.Context) {
    c.JSON(http.StatusOK, gin.H{"status": "Quantiq Go Gateway is running"})
	})
	r.HEAD("/", func(c *gin.Context) {
    c.Status(http.StatusOK)
	})

	// ── Ask ──────────────────────────────────────────────
	r.POST("/ask", func(c *gin.Context) {
		var req QueryRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if req.TimeRange == "" {
			req.TimeRange = "7d"
		}

		start := time.Now()
		context := buildContext(req.Question, req.TimeRange)
		answer, sessionID := generateResponse(req.Question, context, req.SessionID)

		contextUsed := ""
		if req.IncludeSources {
			contextUsed = context
		}

		c.JSON(http.StatusOK, QueryResponse{
			Answer:       answer,
			ContextUsed:  contextUsed,
			ResponseTime: time.Since(start).Seconds(),
			Sources:      detectSources(context),
			SessionID:    sessionID,
		})
	})

	// ── Stock ────────────────────────────────────────────
	r.GET("/stock/:ticker", func(c *gin.Context) {
		c.JSON(http.StatusOK, getStockData(strings.ToUpper(c.Param("ticker"))))
	})

	// ── Session ──────────────────────────────────────────
	r.POST("/session/new", func(c *gin.Context) {
		resp, err := httpClient.Post(
			pythonURL()+"/session/new", "application/json", bytes.NewBuffer([]byte("{}")),
		)
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Session service unavailable"})
			return
		}
		defer resp.Body.Close()
		var result interface{}
		json.NewDecoder(resp.Body).Decode(&result)
		c.JSON(http.StatusOK, result)
	})

	r.DELETE("/session/:id", func(c *gin.Context) {
		req, err := http.NewRequest(
			http.MethodDelete,
			pythonURL()+"/session/"+c.Param("id"),
			nil,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to build request"})
			return
		}
		resp, err := httpClient.Do(req)
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Session service unavailable"})
			return
		}
		defer resp.Body.Close()
		var result interface{}
		json.NewDecoder(resp.Body).Decode(&result)
		c.JSON(http.StatusOK, result)
	})

	// ── Portfolio ─────────────────────────────────────────
	r.POST("/portfolio", func(c *gin.Context) {
		var req struct {
			Tickers   []string `json:"tickers" binding:"required"`
			SessionID string   `json:"session_id"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if len(req.Tickers) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No tickers provided"})
			return
		}
		result, err := analyzePortfolio(req.Tickers, req.SessionID)
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Portfolio service unavailable"})
			return
		}
		c.JSON(http.StatusOK, result)
	})

	r.POST("/portfolio/from-chat", func(c *gin.Context) {
		var req struct {
			Query     string `json:"query" binding:"required"`
			SessionID string `json:"session_id"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		result, err := portfolioFromChat(req.Query, req.SessionID)
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Portfolio service unavailable"})
			return
		}
		c.JSON(http.StatusOK, result)
	})

	// ── Start ────────────────────────────────────────────
	port := os.Getenv("PORT")
	if port == "" {
		port = "8000"
	}
	log.Fatal(r.Run(":" + port))
}