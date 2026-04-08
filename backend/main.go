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

func buildContext(question string) string {
	payload, err := json.Marshal(map[string]string{"question": question})
	if err != nil {
		return "System: Failed to encode request."
	}
	resp, err := httpClient.Post(pythonURL()+"/context", "application/json", bytes.NewBuffer(payload))
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

func generateResponse(question, context string) string {
	payload, err := json.Marshal(map[string]string{
		"question": question,
		"context":  context,
	})
	if err != nil {
		return "System: Failed to encode request."
	}
	resp, err := httpClient.Post(pythonURL()+"/generate", "application/json", bytes.NewBuffer(payload))
	if err != nil {
		return "System: Inference engine currently unavailable."
	}
	defer resp.Body.Close()

	var result struct {
		Answer string `json:"answer"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "Error decoding AI response."
	}
	return result.Answer
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
	if strings.Contains(context, "Stock:") {
		sources = append(sources, "Yahoo Finance (real-time)")
	}
	if strings.Contains(context, "Recent Financial News:") {
		sources = append(sources, "NewsAPI (last 7 days)")
	}
	if strings.Contains(context, "Earnings Schedule") {
		sources = append(sources, "Yahoo Finance (earnings)")
	}
	return sources
}

func main() {
	r := gin.Default()

	// Pull allowed origins from env, fall back to localhost only
	allowedOrigin := os.Getenv("ALLOWED_ORIGIN")
	if allowedOrigin == "" {
		allowedOrigin = "http://localhost:5173"
	}

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{allowedOrigin, "http://localhost:3000"},
		AllowMethods:     []string{"GET", "POST", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type"},
		AllowCredentials: true,
	}))

	r.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "Quantiq Go Gateway is running 🚀"})
	})

	r.POST("/ask", func(c *gin.Context) {
		var req QueryRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		start := time.Now()
		context := buildContext(req.Question)
		answer := generateResponse(req.Question, context)

		contextUsed := ""
		if req.IncludeSources {
			contextUsed = context
		}

		c.JSON(http.StatusOK, QueryResponse{
			Answer:       answer,
			ContextUsed:  contextUsed,
			ResponseTime: time.Since(start).Seconds(),
			Sources:      detectSources(context),
		})
	})

	r.GET("/stock/:ticker", func(c *gin.Context) {
		c.JSON(http.StatusOK, getStockData(strings.ToUpper(c.Param("ticker"))))
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8000"
	}
	log.Fatal(r.Run(":" + port))
}