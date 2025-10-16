import { useEffect, useRef } from 'react';
import { useChartStore } from '../store/chartStore';
import { BinanceAPI } from '../services/binanceAPI';
import { WebSocketService } from '../services/websocketService';

export const useBinanceWebSocket = () => {
  const {
    symbol,
    timeFrame,
    isBacktesting,
    setCandlestickData,
    setVolumeData,
    updateLastCandle,
    calculateHighChannelEntryPoints,
    calculateLowChannelEntryPoints,
    connectMajorPeaks,
    connectMajorLows,
  } = useChartStore();

  const wsServiceRef = useRef<WebSocketService | null>(null);

  useEffect(() => {
    let isMounted = true;

    // 백테스팅 모드일 때는 데이터 로드 및 WebSocket 연결 스킵
    if (isBacktesting) {
      console.log('백테스팅 모드: WebSocket 비활성화');
      return;
    }

    // 1. 히스토리 데이터 로드
    const loadHistoricalData = async () => {
      try {
        console.log(`Loading historical data for ${symbol} ${timeFrame}...`);
        const { candlesticks, volumes } = await BinanceAPI.getKlines(symbol, timeFrame, 500);

        if (isMounted) {
          setCandlestickData(candlesticks);
          setVolumeData(volumes);
          console.log(`Loaded ${candlesticks.length} candles`);

          // 데이터 로드 후 자동으로 양방향 채널 생성
          setTimeout(() => {
            connectMajorPeaks();
            // 고점 채널 생성 후 저점 채널도 생성
            setTimeout(() => {
              connectMajorLows();
            }, 200);
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

            // 양방향 진입점 재계산
            setTimeout(() => {
              calculateHighChannelEntryPoints();
              calculateLowChannelEntryPoints();
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
  }, [symbol, timeFrame, isBacktesting, setCandlestickData, setVolumeData, updateLastCandle, calculateHighChannelEntryPoints, calculateLowChannelEntryPoints, connectMajorPeaks, connectMajorLows]);

  return null;
};
