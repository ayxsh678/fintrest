package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// ── Request / Response models ──────────────────────────

type QueryRequest struct {
	Question       string `json:"question" binding:"required"`
	IncludeSources bool   `json:"include_sources"`
}

type QueryResponse struct {
	Answer       string   `json:"answer"`
	ContextUsed  string   `json:"context_used"`
	ResponseTime float64  `json:"response_time"`
	Sources      []string `json:"sources"`
}

// ── Python service URL ─────────────────────────────────

func pythonURL() string {
	url := os.Getenv("PYTHON_SERVICE_URL")
	if url == "" {
		url = "http://localhost:8001"
	}
	return url
}

// ── Helpers to call Python service ────────────────────

func buildContext(question string) string {
	payload, _ := json.Marshal(map[string]string{"question": question})
	resp, err := http.Post(pythonURL()+"/context", "application/json", bytes.NewBuffer(payload))
	if err != nil {
		return ""
	}
	defer resp.Body.Close()

	var result map[string]string
	json.NewDecoder(resp.Body).Decode(&result)
	return result["context"]
}

func generateResponse(question, context string) string {
	payload, _ := json.Marshal(map[string]string{
		"question": question,
		"context":  context,
	})
	resp, err := http.Post(pythonURL()+"/generate", "application/json", bytes.NewBuffer(payload))
	if err != nil {
		return ""
	}
	defer resp.Body.Close()

	var result map[string]string
	json.NewDecoder(resp.Body).Decode(&result)
	return result["answer"]
}

func getStockData(ticker string) interface{} {
	resp, err := http.Get(pythonURL() + "/stock/" + ticker)
	if err != nil {
		return nil
	}
	defer resp.Body.Close()

	var result interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	return result
}

// ── Main ───────────────────────────────────────────────

func main() {
	r := gin.Default()

	// CORS — allow all origins (restrict in production)
	r.Use(cors.Default())

	// Health check
	r.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "Finance AI is running 🚀"})
	})

	// POST /ask
	r.POST("/ask", func(c *gin.Context) {
		var req QueryRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		if strings.TrimSpace(req.Question) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Question cannot be empty"})
			return
		}

		start := time.Now()

		context := buildContext(req.Question)
		answer := generateResponse(req.Question, context)

		sources := []string{}
		if strings.Contains(context, "Stock:") {
			sources = append(sources, "Yahoo Finance (real-time)")
		}
		if strings.Contains(context, "News:") {
			sources = append(sources, "NewsAPI (last 7 days)")
		}
		if strings.Contains(context, "Earnings:") {
			sources = append(sources, "Alpha Vantage (earnings)")
		}

		contextUsed := ""
		if req.IncludeSources {
			contextUsed = context
		}

		c.JSON(http.StatusOK, QueryResponse{
			Answer:       answer,
			ContextUsed:  contextUsed,
			ResponseTime: time.Since(start).Seconds(),
			Sources:      sources,
		})
	})

	// GET /stock/:ticker
	r.GET("/stock/:ticker", func(c *gin.Context) {
		ticker := strings.ToUpper(c.Param("ticker"))
		data := getStockData(ticker)
		c.JSON(http.StatusOK, gin.H{"data": data})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8000"
	}
	r.Run(":" + port)
}