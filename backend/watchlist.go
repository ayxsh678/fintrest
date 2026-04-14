package main

import (
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func handleGetWatchlist(c *gin.Context) {
	userID := c.GetInt("user_id")
	rows, err := DB.Query(`SELECT ticker FROM watchlist WHERE user_id = $1 ORDER BY added_at DESC`, userID)
	if err != nil {
		log.Printf("ERROR: watchlist query failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch watchlist"})
		return
	}
	defer rows.Close()
	tickers := []string{}
	for rows.Next() {
		var t string
		if err := rows.Scan(&t); err != nil {
			log.Printf("ERROR: watchlist scan failed: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch watchlist"})
			return
		}
		tickers = append(tickers, t)
	}
	if err := rows.Err(); err != nil {
		log.Printf("ERROR: watchlist iteration failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch watchlist"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"watchlist": tickers})
}

func handleAddWatchlist(c *gin.Context) {
	userID := c.GetInt("user_id")
	var req struct {
		Ticker string `json:"ticker" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ticker := strings.ToUpper(strings.TrimSpace(req.Ticker))
	if ticker == "" || len(ticker) > 20 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ticker"})
		return
	}
	result, err := DB.Exec(`INSERT INTO watchlist (user_id, ticker) VALUES ($1, $2) ON CONFLICT DO NOTHING`, userID, ticker)
	if err != nil {
		log.Printf("ERROR: watchlist insert failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add ticker"})
		return
	}
	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Ticker already in watchlist", "ticker": ticker})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Added", "ticker": ticker})
}

func handleDeleteWatchlist(c *gin.Context) {
	userID := c.GetInt("user_id")
	ticker := strings.ToUpper(strings.TrimSpace(c.Param("ticker")))
	if ticker == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ticker"})
		return
	}
	result, err := DB.Exec(`DELETE FROM watchlist WHERE user_id = $1 AND ticker = $2`, userID, ticker)
	if err != nil {
		log.Printf("ERROR: watchlist delete failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove ticker"})
		return
	}
	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ticker not in watchlist", "ticker": ticker})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Removed", "ticker": ticker})
}
