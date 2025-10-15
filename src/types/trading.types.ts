// 바이낸스 API 응답 타입
export interface BinanceKline {
  t: number; // Kline open time
  T: number; // Kline close time
  s: string; // Symbol
  i: string; // Interval
  o: string; // Open price
  c: string; // Close price
  h: string; // High price
  l: string; // Low price
  v: string; // Volume
  n: number; // Number of trades
  x: boolean; // Is this kline closed?
}

export interface BinanceKlineData {
  e: string; // Event type
  E: number; // Event time
  s: string; // Symbol
  k: BinanceKline;
}

// Lightweight Charts 호환 데이터 타입
export interface CandlestickData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface VolumeData {
  time: number;
  value: number;
  color?: string;
}

// 타임프레임 타입
export type TimeFrame = '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '6h' | '8h' | '12h' | '1d' | '3d' | '1w' | '1M';

// 그리기 도구 타입
export type DrawingTool = 'none' | 'trendline' | 'horizontal' | 'rectangle' | 'fibonacciretracement';

export interface Point {
  time: number;
  price: number;
  x?: number;
  y?: number;
}

export interface Drawing {
  id: string;
  type: DrawingTool;
  points: Point[];
  color: string;
  lineWidth: number;
}

// 차트 설정 타입
export interface ChartSettings {
  symbol: string;
  timeFrame: TimeFrame;
  theme: 'dark' | 'light';
}
