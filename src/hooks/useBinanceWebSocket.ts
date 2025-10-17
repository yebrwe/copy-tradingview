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
        const { candlesticks, volumes } = await BinanceAPI.getKlines(symbol, timeFrame, 1000);

        if (isMounted) {
          setCandlestickData(candlesticks);
          setVolumeData(volumes);
          console.log(`Loaded ${candlesticks.length} candles`);

          // 데이터 로드 후 MA200 기반 패턴 판단 후 해당 채널만 생성
          setTimeout(() => {
            // MA200 계산
            const ma200Period = 200;
            let ma200 = 0;

            if (candlesticks.length >= ma200Period) {
              let sum = 0;
              for (let i = candlesticks.length - ma200Period; i < candlesticks.length; i++) {
                sum += candlesticks[i].close;
              }
              ma200 = sum / ma200Period;
            } else if (candlesticks.length > 0) {
              // 데이터가 부족하면 전체 평균 사용
              let sum = 0;
              for (const candle of candlesticks) {
                sum += candle.close;
              }
              ma200 = sum / candlesticks.length;
            }

            const currentPrice = candlesticks[candlesticks.length - 1].close;

            console.log('MA200 기반 패턴 판단:', {
              currentPrice,
              ma200,
              pattern: currentPrice > ma200 ? 'ascending' : 'descending'
            });

            // 패턴에 따라 해당 채널만 생성
            if (currentPrice > ma200) {
              // 상승 추세 → 저점 채널만 생성
              console.log('상승 추세 감지: 저점 채널만 생성');
              connectMajorLows();
            } else {
              // 하락 추세 → 고점 채널만 생성
              console.log('하락 추세 감지: 고점 채널만 생성');
              connectMajorPeaks();
            }
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
