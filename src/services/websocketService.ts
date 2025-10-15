import type { TimeFrame, CandlestickData, VolumeData, BinanceKlineData } from '../types/trading.types';

export class WebSocketService {
  private ws: WebSocket | null = null;
  private symbol: string;
  private interval: TimeFrame;
  private onCandleUpdate: (candle: CandlestickData, volume: VolumeData) => void;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;

  constructor(
    symbol: string,
    interval: TimeFrame,
    onCandleUpdate: (candle: CandlestickData, volume: VolumeData) => void
  ) {
    this.symbol = symbol;
    this.interval = interval;
    this.onCandleUpdate = onCandleUpdate;
  }

  connect() {
    const streamName = `${this.symbol.toLowerCase()}@kline_${this.interval}`;
    const url = `wss://stream.binance.com:9443/ws/${streamName}`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log(`WebSocket connected: ${streamName}`);
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      const data: BinanceKlineData = JSON.parse(event.data);
      const kline = data.k;

      const candle: CandlestickData = {
        time: Math.floor(kline.t / 1000),
        open: parseFloat(kline.o),
        high: parseFloat(kline.h),
        low: parseFloat(kline.l),
        close: parseFloat(kline.c),
      };

      const volume: VolumeData = {
        time: Math.floor(kline.t / 1000),
        value: parseFloat(kline.v),
        color: candle.close >= candle.open ? '#26a69a' : '#ef5350',
      };

      this.onCandleUpdate(candle, volume);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.attemptReconnect();
    };
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  updateStream(symbol: string, interval: TimeFrame) {
    this.symbol = symbol;
    this.interval = interval;
    this.disconnect();
    this.connect();
  }
}
