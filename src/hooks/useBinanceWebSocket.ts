import { useEffect, useRef } from 'react';
import { useChartStore } from '../store/chartStore';
import { BinanceAPI } from '../services/binanceAPI';
import { WebSocketService } from '../services/websocketService';

export const useBinanceWebSocket = () => {
  const {
    symbol,
    timeFrame,
    setCandlestickData,
    setVolumeData,
    updateLastCandle,
    calculateHighChannelEntryPoints,
    connectMajorPeaks,
  } = useChartStore();

  const wsServiceRef = useRef<WebSocketService | null>(null);

  useEffect(() => {
    let isMounted = true;

    // 1. 히스토리 데이터 로드
    const loadHistoricalData = async () => {
      try {
        console.log(`Loading historical data for ${symbol} ${timeFrame}...`);
        const { candlesticks, volumes } = await BinanceAPI.getKlines(symbol, timeFrame, 500);

        if (isMounted) {
          setCandlestickData(candlesticks);
          setVolumeData(volumes);
          console.log(`Loaded ${candlesticks.length} candles`);

          // 데이터 로드 후 자동으로 고점 채널 생성
          setTimeout(() => {
            connectMajorPeaks();
          }, 100);
        }
      } catch (error) {
        console.error('Failed to load historical data:', error);
      }
    };

    // 2. WebSocket 연결
    const connectWebSocket = () => {
      wsServiceRef.current = new WebSocketService(
        symbol,
        timeFrame,
        (candle, volume) => {
          if (isMounted) {
            updateLastCandle(candle);
            // 볼륨도 업데이트하려면 스토어에 updateLastVolume 메서드 추가 필요

            // 진입점 재계산
            setTimeout(() => {
              calculateHighChannelEntryPoints();
            }, 0);
          }
        }
      );

      wsServiceRef.current.connect();
    };

    // 실행
    loadHistoricalData().then(() => {
      if (isMounted) {
        connectWebSocket();
      }
    });

    // 정리
    return () => {
      isMounted = false;
      if (wsServiceRef.current) {
        wsServiceRef.current.disconnect();
      }
    };
  }, [symbol, timeFrame, setCandlestickData, setVolumeData, updateLastCandle, calculateHighChannelEntryPoints, connectMajorPeaks]);

  return null;
};
