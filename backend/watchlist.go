package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func handleGetWatchlist(c *gin.Context) {
	userID := c.GetInt("user_id")
	rows, err := DB.Query(`SELECT ticker FROM watchlist WHERE user_id = $1 ORDER BY added_at DESC`, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch watchlist"})
		return
	}
	defer rows.Close()
	tickers := []string{}
	for rows.Next() {
		var t string
		if err := rows.Scan(&t); err == nil {
			tickers = append(tickers, t)
		}
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
	_, err := DB.Exec(`INSERT INTO watchlist (user_id, ticker) VALUES ($1, $2) ON CONFLICT DO NOTHING`, userID, req.Ticker)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add ticker"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Added", "ticker": req.Ticker})
}

func handleDeleteWatchlist(c *gin.Context) {
	userID := c.GetInt("user_id")
	ticker := c.Param("ticker")
	_, err := DB.Exec(`DELETE FROM watchlist WHERE user_id = $1 AND ticker = $2`, userID, ticker)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove ticker"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Removed", "ticker": ticker})
}
