package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/smtp"
	"net/url"
	"os"
	"strconv"
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

// ── Active session tracking ────────────────────────────

const sessionTTL = 24 * time.Hour

var (
	activeSessions   = make(map[string]time.Time)
	activeSessionsMu sync.Mutex
)

func trackSession(id string) {
	if id == "" {
		return
	}
	activeSessionsMu.Lock()
	activeSessions[id] = time.Now()
	activeSessionsMu.Unlock()
}

func removeSession(id string) {
	if id == "" {
		return
	}
	activeSessionsMu.Lock()
	delete(activeSessions, id)
	activeSessionsMu.Unlock()
}

func getActiveSessions() []string {
	activeSessionsMu.Lock()
	defer activeSessionsMu.Unlock()
	now := time.Now()
	var expired []string
	ids := make([]string, 0, len(activeSessions))
	for id, lastSeen := range activeSessions {
		if now.Sub(lastSeen) > sessionTTL {
			expired = append(expired, id)
			continue
		}
		ids = append(ids, id)
	}
	for _, id := range expired {
		delete(activeSessions, id)
	}
	return ids
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
		log.Printf("[buildContext] retrieval service error: %v", err)
		return "System: Retrieval service currently unavailable."
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		log.Printf("[buildContext] upstream error: status %d", resp.StatusCode)
		return "System: Retrieval service currently unavailable."
	}

	var result struct {
		Context string `json:"context"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		log.Printf("[buildContext] decode error: %v", err)
		return "System: Retrieval service returned malformed data."
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
		log.Printf("[generateResponse] inference service error: %v", err)
		return "System: Inference engine currently unavailable.", sessionID
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		log.Printf("[generateResponse] upstream error: status %d", resp.StatusCode)
		return "System: Inference engine currently unavailable.", sessionID
	}

	var result struct {
		Answer    string `json:"answer"`
		SessionID string `json:"session_id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		log.Printf("[generateResponse] decode error: %v", err)
		return "Error decoding AI response.", sessionID
	}
	if result.SessionID == "" {
		result.SessionID = sessionID
	}
	return result.Answer, result.SessionID
}

func getStockData(ticker string) interface{} {
	resp, err := httpClient.Get(pythonURL() + "/stock/" + url.PathEscape(ticker))
	if err != nil {
		log.Printf("[getStockData] error for %s: %v", ticker, err)
		return gin.H{"error": "Stock service unavailable"}
	}
	defer resp.Body.Close()
	var result interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		log.Printf("[getStockData] decode error: %v", err)
		return gin.H{"error": "Failed to decode stock data"}
	}
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
	if strings.Contains(context, "Crypto:") {
		sources = append(sources, "CoinGecko (real-time)")
	}
	if strings.Contains(context, "Forex:") {
		sources = append(sources, "Open Exchange Rates")
	}
	if strings.Contains(context, "NSE/BSE") {
		sources = append(sources, "Yahoo Finance (NSE/BSE)")
	}
	if strings.Contains(context, "Recent Financial News:") {
		sources = append(sources, "NewsAPI")
	}
	if strings.Contains(context, "Earnings Schedule") {
		sources = append(sources, "Yahoo Finance (earnings)")
	}
	return sources
}

// proxyJSON is the shared transport layer for all Python proxy calls.
// It handles marshalling, the HTTP round-trip, status checking, and JSON
// decoding into interface{} so any top-level shape (object, array, primitive)
// is accepted. method must be "GET" or "POST".
func proxyJSON(method, path string, body interface{}) (interface{}, error) {
	var req *http.Request
	var err error
	switch method {
	case http.MethodGet:
		req, err = http.NewRequest(http.MethodGet, pythonURL()+path, nil)
	case http.MethodPost:
		var payload []byte
		payload, err = json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("proxyJSON marshal error: %w", err)
		}
		req, err = http.NewRequest(http.MethodPost, pythonURL()+path, bytes.NewBuffer(payload))
		if err == nil {
			req.Header.Set("Content-Type", "application/json")
		}
	default:
		return nil, fmt.Errorf("proxyJSON: unsupported method %q", method)
	}
	if err != nil {
		return nil, fmt.Errorf("proxyJSON build request error [%s %s]: %w", method, path, err)
	}
	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("proxyJSON request error [%s %s]: %w", method, path, err)
	}
	defer resp.Body.Close()
	// Pass 4xx errors (user/input errors) back to caller as-is so the
	// client gets a meaningful message instead of "service unavailable".
	if resp.StatusCode >= 500 {
		return nil, fmt.Errorf("proxyJSON upstream error [%s %s]: status %d", method, path, resp.StatusCode)
	}
	if resp.StatusCode >= 400 {
		var clientErr interface{}
		if err := json.NewDecoder(resp.Body).Decode(&clientErr); err == nil {
			return clientErr, nil
		}
		return nil, fmt.Errorf("proxyJSON client error [%s %s]: status %d", method, path, resp.StatusCode)
	}
	var result interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("proxyJSON decode error [%s %s]: %w", method, path, err)
	}
	return result, nil
}

func proxyGet(path string) (map[string]interface{}, error) {
	raw, err := proxyJSON(http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	if m, ok := raw.(map[string]interface{}); ok {
		return m, nil
	}
	return nil, fmt.Errorf("proxyGet: unexpected response shape for %s: got %T", path, raw)
}

func proxyPost(path string, body interface{}) (map[string]interface{}, error) {
	raw, err := proxyJSON(http.MethodPost, path, body)
	if err != nil {
		return nil, err
	}
	if m, ok := raw.(map[string]interface{}); ok {
		return m, nil
	}
	return nil, fmt.Errorf("proxyPost: unexpected response shape for %s: got %T", path, raw)
}

func proxyPostSlice(path string, body interface{}) ([]interface{}, error) {
	payload, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("proxyPostSlice marshal error: %w", err)
	}
	resp, err := httpClient.Post(
		pythonURL()+path, "application/json", bytes.NewBuffer(payload),
	)
	if err != nil {
		return nil, fmt.Errorf("proxyPostSlice request error [%s]: %w", path, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("proxyPostSlice upstream error [%s]: status %d", path, resp.StatusCode)
	}

	var result []interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("proxyPostSlice decode error [%s]: %w", path, err)
	}
	return result, nil
}

// ── Email notification ─────────────────────────────────

func sendAlertEmail(alert map[string]interface{}) {
	smtpUser   := os.Getenv("SMTP_USER")
	smtpPass   := os.Getenv("SMTP_PASS")
	alertEmail := os.Getenv("ALERT_EMAIL")
	smtpHost   := os.Getenv("SMTP_HOST")
	smtpPort   := os.Getenv("SMTP_PORT")

	if smtpUser == "" || smtpPass == "" || alertEmail == "" {
		log.Printf("[alert] Email env vars not set — skipping for %v", alert["ticker"])
		return
	}
	if smtpHost == "" {
		smtpHost = "smtp.gmail.com"
	}
	if smtpPort == "" {
		smtpPort = "587"
	}

	smtpPortInt, err := strconv.Atoi(smtpPort)
	if err != nil || smtpPortInt <= 0 {
		log.Printf("[alert] Invalid SMTP_PORT %q — skipping alert for %v: %v", smtpPort, alert["ticker"], err)
		return
	}
	smtpAddr := net.JoinHostPort(smtpHost, strconv.Itoa(smtpPortInt))

	fmtField := func(key string) string {
		v, ok := alert[key]
		if !ok || v == nil {
			return "N/A"
		}
		return fmt.Sprintf("%v", v)
	}
	ticker         := fmtField("ticker")
	triggeredPrice := fmtField("triggered_price")
	threshold      := fmtField("threshold")
	direction      := fmtField("direction")

	if ticker == "N/A" {
		log.Printf("[alert] Missing ticker in alert payload — skipping email")
		return
	}

	subject := fmt.Sprintf("Fintrest Alert: %s hit your price target", ticker)
	body    := fmt.Sprintf(
		"Your Fintrest alert has triggered!\n\n"+
			"Ticker:       %s\n"+
			"Direction:    %s $%s\n"+
			"Triggered at: $%s\n\n"+
			"Log in to Fintrest to review your portfolio.",
		ticker, direction, threshold, triggeredPrice,
	)

	msg  := fmt.Sprintf("To: %s\r\nSubject: %s\r\n\r\n%s", alertEmail, subject, body)
	auth := smtp.PlainAuth("", smtpUser, smtpPass, smtpHost)

	if err := smtp.SendMail(smtpAddr, auth, smtpUser,
		[]string{alertEmail}, []byte(msg)); err != nil {
		log.Printf("[alert] Failed to send email for %s: %v", ticker, err)
	} else {
		log.Printf("[alert] Email sent for %s trigger", ticker)
	}
}

// ── Background alert poller ────────────────────────────

func startAlertPoller() {
	go func() {
		log.Println("[alert poller] Started — checking every 5 minutes")
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()

		for range ticker.C {
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
					log.Printf("[alert poller] error for session %s: %v", sid, err)
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
					log.Printf("[alert poller] Triggered: %v @ $%v",
						alert["ticker"], alert["triggered_price"])
					sendAlertEmail(alert)
				}
			}
		}
	}()
}

// ── CORS origin checker ────────────────────────────────

func isAllowedOrigin(origin string) bool {
	// Always allow localhost for development
	if origin == "http://localhost:3000" || origin == "http://localhost:5173" {
		return true
	}
	// Allow all Vercel preview deploys for this project
	if strings.HasSuffix(origin, "-ayxsh678s-projects.vercel.app") ||
		origin == "https://finance-ai-8qu9.vercel.app" {
		return true
	}
	// Allow explicit production origins from env (comma-separated allowlist)
	if prod := os.Getenv("ALLOWED_ORIGIN"); prod != "" {
		for _, allowed := range strings.Split(prod, ",") {
			if strings.TrimSpace(allowed) == origin {
				return true
			}
		}
	}
	return false
}

// ── Main ───────────────────────────────────────────────

func main() {
	initJWTSecret()
	InitDB()

	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOriginFunc:  isAllowedOrigin,
		AllowMethods:     []string{"GET", "POST", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
	}))

	// ── Health ─────────────────────────────────────────
	r.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "Fintrest Go Gateway is running"})
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
		start   := time.Now()
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
		ticker := strings.ToUpper(strings.TrimSpace(c.Param("ticker")))
		if ticker == "" || len(ticker) > 20 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ticker"})
			return
		}
		c.JSON(http.StatusOK, getStockData(ticker))
	})

	// ── Sentiment ──────────────────────────────────────
	r.GET("/sentiment/:ticker", func(c *gin.Context) {
		ticker  := strings.ToUpper(c.Param("ticker"))
		company := c.DefaultQuery("company", "")
		path    := "/sentiment/" + url.PathEscape(ticker)
		if company != "" {
			path += "?company=" + url.QueryEscape(company)
		}
		resp, err := httpClient.Get(pythonURL() + path)
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Sentiment service unavailable"})
			return
		}
		defer resp.Body.Close()
		var result interface{}
		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode sentiment data"})
			return
		}
		c.JSON(http.StatusOK, result)
	})

	r.GET("/news/:ticker", func(c *gin.Context) {
		ticker  := strings.ToUpper(c.Param("ticker"))
		company := c.DefaultQuery("company", "")
		days    := c.DefaultQuery("days", "7")
		path    := "/news/" + url.PathEscape(ticker) + "?days=" + url.QueryEscape(days)
		if company != "" {
			path += "&company=" + url.QueryEscape(company)
		}
		resp, err := httpClient.Get(pythonURL() + path)
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "News service unavailable"})
			return
		}
		defer resp.Body.Close()
		var result interface{}
		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode news data"})
			return
		}
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
		sid := c.Param("id")
		removeSession(sid)
		req, err := http.NewRequest(
			http.MethodDelete,
			pythonURL()+"/session/"+url.PathEscape(sid),
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
		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			log.Printf("[DELETE /session] decode error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode session response"})
			return
		}
		c.JSON(http.StatusOK, result)
	})

	// ── Watchlist Enrich ───────────────────────────────
	r.POST("/watchlist/enrich", func(c *gin.Context) {
		var req struct {
			Tickers []string `json:"tickers" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if len(req.Tickers) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "tickers must be a non-empty array"})
			return
		}
		result, err := proxyPost("/watchlist/enrich", req)
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Enrichment service unavailable"})
			return
		}
		c.JSON(http.StatusOK, result)
	})

	// ── Session History ────────────────────────────────
	r.GET("/session/:id/history", func(c *gin.Context) {
		sid := url.PathEscape(c.Param("id"))
		result, err := proxyGet("/session/" + sid + "/history")
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Session service unavailable"})
			return
		}
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

	// ── Forex ──────────────────────────────────────────
	r.GET("/forex/pairs", func(c *gin.Context) {
		resp, err := httpClient.Get(pythonURL() + "/forex/pairs")
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Forex service unavailable"})
			return
		}
		defer resp.Body.Close()
		var result interface{}
		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			log.Printf("[forex/pairs] decode error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode forex pairs"})
			return
		}
		c.JSON(http.StatusOK, result)
	})

	r.POST("/forex", func(c *gin.Context) {
		var req struct {
			Pair      string `json:"pair" binding:"required"`
			SessionID string `json:"session_id"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		result, err := proxyPost("/forex", req)
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Forex service unavailable"})
			return
		}
		c.JSON(http.StatusOK, result)
	})

	r.POST("/forex/from-chat", func(c *gin.Context) {
		var req struct {
			Query     string `json:"query" binding:"required"`
			SessionID string `json:"session_id"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		result, err := proxyPost("/forex/from-chat", req)
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Forex service unavailable"})
			return
		}
		c.JSON(http.StatusOK, result)
	})

	// ── Explain ────────────────────────────────────────
	r.POST("/explain", func(c *gin.Context) {
		var req struct {
			Term      string `json:"term" binding:"required"`
			Stock     string `json:"stock"`
			Context   string `json:"context"`
			SessionID string `json:"session_id"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		result, err := proxyPost("/explain", req)
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Explain service unavailable"})
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

	// ── Auth (public) ──────────────────────────────────
	r.POST("/register", handleRegister)
	r.POST("/login",    handleLogin)

	// ── Protected routes ───────────────────────────────
	authGroup := r.Group("/")
	authGroup.Use(AuthMiddleware())
	{
		authGroup.GET("/watchlist",            handleGetWatchlist)
		authGroup.POST("/watchlist",           handleAddWatchlist)
		authGroup.DELETE("/watchlist/:ticker", handleDeleteWatchlist)
	}

	// ── Start poller + server ──────────────────────────
	startAlertPoller()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8000"
	}
	log.Fatal(r.Run(":" + port))
}