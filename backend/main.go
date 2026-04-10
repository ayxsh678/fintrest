package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/smtp"
	"os"
	"strings"
	"sync"
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

// ── Active session tracking (for alert polling) ─────────

var (
	activeSessions   = make(map[string]struct{})
	activeSessionsMu sync.Mutex
)

func trackSession(id string) {
	if id == "" {
		return
	}
	activeSessionsMu.Lock()
	activeSessions[id] = struct{}{}
	activeSessionsMu.Unlock()
}

func getActiveSessions() []string {
	activeSessionsMu.Lock()
	defer activeSessionsMu.Unlock()
	ids := make([]string, 0, len(activeSessions))
	for id := range activeSessions {
		ids = append(ids, id)
	}
	return ids
}

// ── Global config ───────────────────────────────────────

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

// ── Helpers ─────────────────────────────────────────────

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

func proxyPost(path string, body interface{}) (map[string]interface{}, error) {
	payload, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	resp, err := httpClient.Post(
		pythonURL()+path, "application/json", bytes.NewBuffer(payload),
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

// proxyPostSlice is like proxyPost but returns a JSON array.
// Used for /get_alerts which returns a list.
func proxyPostSlice(path string, body interface{}) ([]interface{}, error) {
	payload, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	resp, err := httpClient.Post(
		pythonURL()+path, "application/json", bytes.NewBuffer(payload),
	)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result []interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}

// ── Email notification ──────────────────────────────────

func sendAlertEmail(alert map[string]interface{}) {
	smtpUser := os.Getenv("SMTP_USER")
	smtpPass := os.Getenv("SMTP_PASS")
	alertEmail := os.Getenv("ALERT_EMAIL")

	if smtpUser == "" || smtpPass == "" || alertEmail == "" {
		log.Printf("[alert] Email env vars not set — skipping email for %v", alert["ticker"])
		return
	}

	ticker := fmt.Sprintf("%v", alert["ticker"])
	triggeredPrice := fmt.Sprintf("%v", alert["triggered_price"])
	threshold := fmt.Sprintf("%v", alert["threshold"])
	direction := fmt.Sprintf("%v", alert["direction"])

	subject := fmt.Sprintf("Quantiq Alert: %s hit your price target", ticker)
	body := fmt.Sprintf(
		"Your Quantiq alert has triggered!\n\n"+
			"Ticker:           %s\n"+
			"Direction:        %s $%s\n"+
			"Triggered at:     $%s\n\n"+
			"Log in to Quantiq to review your portfolio.",
		ticker, direction, threshold, triggeredPrice,
	)

	msg := fmt.Sprintf("Subject: %s\r\n\r\n%s", subject, body)

	auth := smtp.PlainAuth("", smtpUser, smtpPass, "smtp.gmail.com")
	err := smtp.SendMail(
		"smtp.gmail.com:587",
		auth,
		smtpUser,
		[]string{alertEmail},
		[]byte(msg),
	)
	if err != nil {
		log.Printf("[alert] Failed to send email for %s: %v", ticker, err)
	} else {
		log.Printf("[alert] Email sent for %s trigger", ticker)
	}
}

// ── Background alert poller ─────────────────────────────

func startAlertPoller() {
	go func() {
		log.Println("[alert poller] Started — checking every 5 minutes")
		for {
			time.Sleep(5 * time.Minute)

			sessions := getActiveSessions()
			if len(sessions) == 0 {
				continue
			}

			log.Printf("[alert poller] Checking %d session(s)", len(sessions))

			for _, sid := range sessions {
				result, err := proxyPost("/check_alerts", map[string]string{
					"session_id": sid,
				})
				if err != nil {
					log.Printf("[alert poller] check_alerts error for session %s: %v", sid, err)
					continue
				}

				triggered, ok := result["triggered"].([]interface{})
				if !ok || len(triggered) == 0 {
					continue
				}

				for _, item := range triggered {
					alert, ok := item.(map[string]interface{})
					if !ok {
						continue
					}
					log.Printf("[alert poller] Alert triggered: %v @ $%v",
						alert["ticker"], alert["triggered_price"])
					sendAlertEmail(alert)
				}
			}
		}
	}()
}

// ── Main ────────────────────────────────────────────────

func main() {
	InitDB()
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

	// ── Health ─────────────────────────────────────────
	r.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "Quantiq Go Gateway is running"})
	})

	// ── Ask ────────────────────────────────────────────
	r.POST("/ask", func(c *gin.Context) {
		var req QueryRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if req.TimeRange == "" {
			req.TimeRange = "7d"
		}
		trackSession(req.SessionID)
		start := time.Now()
		context := buildContext(req.Question, req.TimeRange)
		answer, sessionID := generateResponse(req.Question, context, req.SessionID)
		trackSession(sessionID)
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

	// ── Stock ──────────────────────────────────────────
	r.GET("/stock/:ticker", func(c *gin.Context) {
		c.JSON(http.StatusOK, getStockData(strings.ToUpper(c.Param("ticker"))))
	})

	// ── Sentiment ──────────────────────────────────────
	r.GET("/sentiment/:ticker", func(c *gin.Context) {
		ticker := strings.ToUpper(c.Param("ticker"))
		company := c.DefaultQuery("company", "")
		path := "/sentiment/" + ticker
		if company != "" {
			path += "?company=" + company
		}
		resp, err := httpClient.Get(pythonURL() + path)
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Sentiment service unavailable"})
			return
		}
		defer resp.Body.Close()
		var result interface{}
		json.NewDecoder(resp.Body).Decode(&result)
		c.JSON(http.StatusOK, result)
	})

	// ── Session ────────────────────────────────────────
	r.POST("/session/new", func(c *gin.Context) {
		result, err := proxyPost("/session/new", map[string]string{})
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Session service unavailable"})
			return
		}
		if sid, ok := result["session_id"].(string); ok {
			trackSession(sid)
		}
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

	// ── Portfolio ──────────────────────────────────────
	r.POST("/portfolio", func(c *gin.Context) {
		var req struct {
			Tickers   []string `json:"tickers" binding:"required"`
			SessionID string   `json:"session_id"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		trackSession(req.SessionID)
		result, err := proxyPost("/portfolio", req)
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
		trackSession(req.SessionID)
		result, err := proxyPost("/portfolio/from-chat", req)
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Portfolio service unavailable"})
			return
		}
		c.JSON(http.StatusOK, result)
	})

	// ── Compare ────────────────────────────────────────
	r.POST("/compare", func(c *gin.Context) {
		var req struct {
			TickerA   string `json:"ticker_a" binding:"required"`
			TickerB   string `json:"ticker_b" binding:"required"`
			SessionID string `json:"session_id"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		trackSession(req.SessionID)
		result, err := proxyPost("/compare", req)
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Comparison service unavailable"})
			return
		}
		c.JSON(http.StatusOK, result)
	})

	r.POST("/compare/from-chat", func(c *gin.Context) {
		var req struct {
			Query     string `json:"query" binding:"required"`
			SessionID string `json:"session_id"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		trackSession(req.SessionID)
		result, err := proxyPost("/compare/from-chat", req)
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Comparison service unavailable"})
			return
		}
		c.JSON(http.StatusOK, result)
	})

	// ── Alerts ─────────────────────────────────────────
	r.POST("/create_alert", func(c *gin.Context) {
		var body map[string]interface{}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if sid, ok := body["session_id"].(string); ok {
			trackSession(sid)
		}
		result, err := proxyPost("/create_alert", body)
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Alert service unavailable"})
			return
		}
		c.JSON(http.StatusOK, result)
	})

	r.POST("/get_alerts", func(c *gin.Context) {
		var body map[string]interface{}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		result, err := proxyPostSlice("/get_alerts", body)
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Alert service unavailable"})
			return
		}
		c.JSON(http.StatusOK, result)
	})

	r.POST("/delete_alert", func(c *gin.Context) {
		var body map[string]interface{}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		result, err := proxyPost("/delete_alert", body)
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Alert service unavailable"})
			return
		}
		c.JSON(http.StatusOK, result)
	})

	r.POST("/check_alerts", func(c *gin.Context) {
		var body map[string]interface{}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		result, err := proxyPost("/check_alerts", body)
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Alert service unavailable"})
			return
		}
		c.JSON(http.StatusOK, result)
	})

	// ── Start poller & server ──────────────────────────
	startAlertPoller()




	// ── Auth (public) ─────────────────────────────────
	r.POST("/register", handleRegister)
	r.POST("/login", handleLogin)

	// ── Protected routes ──────────────────────────────
	authGroup := r.Group("/")
	authGroup.Use(AuthMiddleware())
	{
		authGroup.GET("/watchlist", handleGetWatchlist)
		authGroup.POST("/watchlist", handleAddWatchlist)
		authGroup.DELETE("/watchlist/:ticker", handleDeleteWatchlist)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8000"
	}
	log.Fatal(r.Run(":" + port))
}