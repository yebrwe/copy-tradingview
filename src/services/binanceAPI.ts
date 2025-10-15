import type { TimeFrame, CandlestickData, VolumeData } from '../types/trading.types';

const BASE_URL = 'https://api.binance.com/api/v3';

export class BinanceAPI {
  /**
   * 히스토리 캔들 데이터 가져오기
   * @param symbol 심볼 (예: ETHUSDT)
   * @param interval 타임프레임
   * @param limit 가져올 캔들 개수 (최대 1000)
   */
  static async getKlines(
    symbol: string,
    interval: TimeFrame,
    limit: number = 500
  ): Promise<{ candlesticks: CandlestickData[]; volumes: VolumeData[] }> {
    try {
      const url = `${BASE_URL}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Binance API error: ${response.statusText}`);
      }

      const data = await response.json();

      const candlesticks: CandlestickData[] = [];
      const volumes: VolumeData[] = [];

      data.forEach((kline: any[]) => {
        const time = Math.floor(kline[0] / 1000); // 밀리초를 초로 변환
        const open = parseFloat(kline[1]);
        const high = parseFloat(kline[2]);
        const low = parseFloat(kline[3]);
        const close = parseFloat(kline[4]);
        const volume = parseFloat(kline[5]);

        candlesticks.push({ time, open, high, low, close });

        volumes.push({
          time,
          value: volume,
          color: close >= open ? '#26a69a' : '#ef5350',
        });
      });

      return { candlesticks, volumes };
    } catch (error) {
      console.error('Failed to fetch klines:', error);
      throw error;
    }
  }

  /**
   * 현재 가격 가져오기
   */
  static async getCurrentPrice(symbol: string): Promise<number> {
    try {
      const url = `${BASE_URL}/ticker/price?symbol=${symbol}`;
      const response = await fetch(url);
      const data = await response.json();
      return parseFloat(data.price);
    } catch (error) {
      console.error('Failed to fetch current price:', error);
      throw error;
    }
  }
}
