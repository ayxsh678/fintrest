import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict
import logging

from rag.sentiment import get_sentiment

logger = logging.getLogger(__name__)


class SentimentBacktester:
    def __init__(self,
                 buy_threshold: float = 65.0,
                 sell_threshold: float = 40.0,
                 hold_days: int = 7):
        
        self.buy_threshold = buy_threshold
        self.sell_threshold = sell_threshold
        self.hold_days = hold_days

    def run_backtest(self, ticker: str) -> Dict:
        """Safe sentiment-based backtest"""
        try:
            logger.info("Fetching historical data for %s...", ticker)

            end = datetime.now()
            start = end - timedelta(days=400)
            data = yf.download(ticker, start=start, end=end, progress=False)

            if data.empty or len(data) < 60:
                return {"error": "Not enough historical price data", "success": False}

            # Use .squeeze() to ensure we have a clean Series
            close_prices = data['Close'].squeeze()

            trades = []
            equity = 100000.0
            position = 0
            entry_price = 0.0
            entry_date = None

            logger.info("Running backtest with %d trading days...", len(close_prices))

            # Fetch sentiment once — cached inside get_sentiment; calling it per-day is wasteful
            sent_result = get_sentiment(ticker)
            sentiment_score = sent_result.get("score", 50.0)

            for i in range(20, len(close_prices)):
                current_date = close_prices.index[i].date()

                # Ultra-safe price extraction
                price_value = close_prices.iloc[i]
                current_price = float(price_value.item() if hasattr(price_value, 'item') else price_value)

                if position == 0:
                    if sentiment_score >= self.buy_threshold:
                        position = 1
                        entry_price = current_price
                        entry_date = current_date
                        trades.append({
                            "action": "BUY",
                            "date": current_date.strftime("%Y-%m-%d"),
                            "price": round(current_price, 2),
                            "sentiment": round(sentiment_score, 1)
                        })
                else:
                    days_held = (current_date - entry_date).days
                    if days_held >= self.hold_days or sentiment_score <= self.sell_threshold:
                        pnl = (current_price - entry_price) / entry_price
                        equity *= (1 + pnl)

                        trades.append({
                            "action": "SELL",
                            "date": current_date.strftime("%Y-%m-%d"),
                            "price": round(current_price, 2),
                            "pnl_%": round(pnl * 100, 2),
                            "sentiment": round(sentiment_score, 1)
                        })
                        position = 0

            # Final prices - safe extraction
            final_price = float(close_prices.iloc[-1].item() if hasattr(close_prices.iloc[-1], 'item') else close_prices.iloc[-1])
            first_price = float(close_prices.iloc[0].item() if hasattr(close_prices.iloc[0], 'item') else close_prices.iloc[0])

            total_return = (equity - 100000) / 100000 * 100
            buy_hold_return = (final_price / first_price - 1) * 100

            result = {
                "ticker": ticker.upper(),
                "success": True,
                "strategy_final_value": round(equity, 2),
                "strategy_return_%": round(total_return, 2),
                "buy_and_hold_return_%": round(buy_hold_return, 2),
                "number_of_trades": len(trades) // 2,
                "trades": trades[-8:],
                "hold_days": self.hold_days,
                "note": "Using recent sentiment for every day",
                "message": f"Backtest completed for {ticker}"
            }

            logger.info("Backtest finished — Strategy Return: %.2f%% | Buy & Hold: %.2f%%", total_return, buy_hold_return)
            return result

        except Exception as e:
            logger.error(f"Backtest error for {ticker}: {e}")
            return {
                "success": False,
                "error": str(e),
                "ticker": ticker.upper()
            }


def run_backtest(ticker: str, hold_days: int = 7) -> Dict:
    backtester = SentimentBacktester(hold_days=hold_days)
    return backtester.run_backtest(ticker)