ㄴ# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A TradingView-style real-time cryptocurrency chart application for Ethereum (ETH/USDT) with drawing tools, built using React, TypeScript, and Lightweight Charts v4.2.0.

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (runs on http://localhost:5173 or next available port)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint
```

## Architecture

### Data Flow Architecture

1. **Real-time Data Pipeline**
   - `useBinanceWebSocket` hook orchestrates data fetching
   - On mount: Fetches 500 historical candles via `BinanceAPI.getKlines()`
   - Then: Establishes WebSocket connection via `WebSocketService`
   - Updates flow to Zustand store via `updateLastCandle()`

2. **State Management (Zustand)**
   - Single global store in `src/store/chartStore.ts`
   - **Critical**: `setTimeFrame()` clears all chart data when timeframe changes
   - Chart data is immutable - always create new arrays when updating
   - Drawing state is separate from chart data

3. **Chart Rendering Flow**
   - `TradingChart` component manages Lightweight Charts instance lifecycle
   - Two separate series: candlestick (main) and histogram (volume)
   - Chart refs (`chartRef`, `candlestickSeriesRef`, `volumeSeriesRef`) must be cleaned up on unmount
   - Canvas-based `DrawingLayer` overlays on top of chart for user drawings

### Key Integration Points

**Binance API Integration**
- WebSocket: `wss://stream.binance.com:9443/ws/{symbol}@kline_{interval}`
- REST API: `https://api.binance.com/api/v3/klines`
- Time conversion: Binance returns milliseconds, Lightweight Charts expects seconds
- Automatic reconnection with exponential backoff (max 5 attempts)

**Lightweight Charts v4.2.0**
- Must use v4, not v5 - breaking API changes in v5
- Import types separately: `import { createChart } from 'lightweight-charts'; import type { IChartApi } from 'lightweight-charts';`
- Candlestick data format: `{ time: number, open: number, high: number, low: number, close: number }`
- Time must be in **seconds** (Unix timestamp)

**Drawing System**
- Canvas overlay positioned absolutely over chart container
- Mouse coordinates converted to canvas coordinates via `getBoundingClientRect()`
- Drawing state stored as array of `Drawing` objects with unique IDs
- Currently supports: trendline, horizontal line, rectangle

## Configuration Notes

**PostCSS/Tailwind**
- Uses `postcss.config.cjs` (CommonJS) due to `package.json` having `"type": "module"`
- Tailwind v3.4.17 specifically - v4 has incompatible PostCSS plugin

**TypeScript**
- Strict mode enabled
- All Binance API types defined in `src/types/trading.types.ts`
- Lightweight Charts types imported separately to avoid bundling issues

## Common Patterns

**Adding a new timeframe:**
1. Add to `TimeFrame` type in `trading.types.ts`
2. Add to `timeframes` array in `TimeframeSelector.tsx`
3. No other changes needed - Binance API handles all intervals

**Adding a new drawing tool:**
1. Add type to `DrawingTool` union in `trading.types.ts`
2. Add tool to `tools` array in `Toolbar.tsx`
3. Implement drawing logic in `DrawingLayer.tsx` `drawShape()` switch statement

**Changing crypto symbol:**
- Update `symbol` initial state in `chartStore.ts` (default: 'ETHUSDT')
- Symbol must be uppercase for Binance API
- WebSocket stream name uses lowercase

## External API References

- [Binance WebSocket Streams](https://binance-docs.github.io/apidocs/spot/en/#websocket-market-streams)
- [Binance REST API - Klines](https://binance-docs.github.io/apidocs/spot/en/#kline-candlestick-data)
- [Lightweight Charts v4 Docs](https://tradingview.github.io/lightweight-charts/)
