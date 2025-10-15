import { useEffect, useRef } from 'react';
import { useChartStore } from '../store/chartStore';
import { BinanceFuturesAPI } from '../services/binanceFuturesAPI';
import { useToastStore } from '../store/toastStore';
import { useOrderHistoryStore } from '../store/orderHistoryStore';

interface AutoTradingConfig {
  enabled: boolean;
  leverage: number;
  quantity: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  useStopLoss: boolean;
  useTakeProfit: boolean;
  usePercentage?: boolean;
  accountPercentage?: number;
  balance?: number;
}

// 바이낸스 선물 수수료율
const MAKER_FEE = 0.0002; // 0.02%
const TAKER_FEE = 0.0004; // 0.04%

// API 호출 간 딜레이 (밀리초)
const API_CALL_DELAY = 300; // 300ms
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 자동 거래 Hook
 * 1시간 정각마다 실행되며 다음 작업 수행:
 * 1. 이전 미체결 주문 취소
 * 2. 새로운 진입점에 주문 생성 (스탑로스 포함)
 */
export const useAutoTrading = (config: AutoTradingConfig) => {
  const { symbol, candlestickData, highChannelEntryPoints } = useChartStore();
  const { showError, showSuccess } = useToastStore();
  const { addOrder } = useOrderHistoryStore();
  const lastCandleTimeRef = useRef<number | null>(null);
  const isInitializedRef = useRef(false);

  // 비율 기반 수량 계산
  const calculateQuantityFromPercentage = (currentPrice: number): number => {
    if (!config.usePercentage || !config.balance) {
      return config.quantity;
    }

    const percentage = (config.accountPercentage || 10) / 100;
    const availableMargin = config.balance * percentage;
    const calculatedQty = (availableMargin * config.leverage) / currentPrice;

    console.log('비율 기반 수량 계산:', {
      balance: config.balance,
      percentage: percentage * 100 + '%',
      availableMargin,
      leverage: config.leverage,
      currentPrice,
      calculatedQty,
    });

    return calculatedQty;
  };

  // 레버리지 및 수수료 계산
  const calculateTradingMetrics = (
    entryPrice: number,
    stopLossPrice: number,
    quantity: number
  ) => {
    const { leverage } = config;

    // 필요 증거금
    const margin = (entryPrice * quantity) / leverage;

    // 진입 수수료 (테이커)
    const entryFee = entryPrice * quantity * TAKER_FEE;

    // 청산 수수료 (테이커)
    const exitFee = stopLossPrice * quantity * TAKER_FEE;

    // 총 수수료
    const totalFee = entryFee + exitFee;

    // 손실액 (레버리지 적용)
    const priceMove = Math.abs(stopLossPrice - entryPrice);
    const loss = priceMove * quantity * leverage;

    // 총 손실 (손실액 + 수수료)
    const totalLoss = loss + totalFee;

    // 손실률 (증거금 대비)
    const lossPercent = (totalLoss / margin) * 100;

    return {
      margin,
      entryFee,
      exitFee,
      totalFee,
      loss,
      totalLoss,
      lossPercent,
    };
  };

  // 자동 거래 실행
  const executeAutoTrading = async () => {
    if (!config.enabled) {
      console.log('자동 거래가 비활성화되어 있습니다.');
      return;
    }

    if (!highChannelEntryPoints.longEntry || !highChannelEntryPoints.shortEntry) {
      console.log('진입점이 계산되지 않았습니다.');
      return;
    }

    console.log('=== 자동 거래 시작 ===');
    console.log('시간:', new Date().toLocaleString());

    try {
      // 1. 레버리지 설정
      await BinanceFuturesAPI.setLeverage(symbol, config.leverage);

      // 2. 이전 미체결 주문 모두 취소
      console.log('이전 미체결 주문 취소 중...');
      await BinanceFuturesAPI.cancelAllOpenOrders(symbol);

      // 3. 롱 진입 리밋 주문 생성
      const longEntry = highChannelEntryPoints.longEntry;
      const longStopLoss = config.useStopLoss
        ? longEntry * (1 - config.stopLossPercent / 100)
        : undefined;
      const longTakeProfit = config.useTakeProfit
        ? longEntry * (1 + config.takeProfitPercent / 100)
        : undefined;
      const longQuantity = calculateQuantityFromPercentage(longEntry);
      const longPairId = `auto_long_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      console.log(`롱 리밋 주문 생성 중: 진입=${longEntry.toFixed(2)}, 스탑로스=${longStopLoss?.toFixed(2)}, 테이크프로핏=${longTakeProfit?.toFixed(2)}, 수량=${longQuantity.toFixed(4)}`);

      if (longStopLoss) {
        const longMetrics = calculateTradingMetrics(longEntry, longStopLoss, longQuantity);
        console.log('롱 포지션 지표:', longMetrics);
      }

      const longOrder = await BinanceFuturesAPI.createLimitOrder(
        symbol,
        'BUY',
        longQuantity,
        longEntry
      );
      console.log('롱 리밋 주문 생성 완료:', longOrder);

      // 주문 내역 저장
      addOrder({
        symbol,
        side: 'BUY',
        type: 'LIMIT',
        quantity: longQuantity,
        price: longEntry,
        status: 'pending',
        orderId: longOrder.orderId,
        isAutoTrading: true,
        pairId: longPairId,
      });

      // 롱 스탑로스 주문
      if (longStopLoss) {
        try {
          await delay(API_CALL_DELAY); // API 호출 간 딜레이
          const longStopOrder = await BinanceFuturesAPI.createOrder({
            symbol,
            side: 'SELL',
            type: 'STOP_MARKET',
            quantity: longQuantity,
            stopPrice: longStopLoss,
            reduceOnly: true,
          });
          console.log('롱 스탑로스 설정 완료:', longStopOrder);

          // 스탑로스 주문 내역 저장
          addOrder({
            symbol,
            side: 'SELL',
            type: 'STOP_MARKET',
            quantity: longQuantity,
            stopPrice: longStopLoss,
            status: 'pending',
            orderId: longStopOrder.orderId,
            isAutoTrading: true,
            pairId: longPairId,
          });
        } catch (error: any) {
          // -2021: Order would immediately trigger 에러는 경고만 로그
          if (error.message?.includes('-2021') || error.message?.includes('immediately trigger')) {
            console.warn('롱 스탑로스 주문 스킵 (가격 조건 불일치):', error.message);
          } else {
            console.error('롱 스탑로스 주문 실패:', error);
          }
        }
      }

      // 롱 테이크프로핏 주문
      if (longTakeProfit) {
        try {
          await delay(API_CALL_DELAY); // API 호출 간 딜레이
          const longTakeProfitOrder = await BinanceFuturesAPI.createOrder({
            symbol,
            side: 'SELL',
            type: 'TAKE_PROFIT_MARKET',
            quantity: longQuantity,
            stopPrice: longTakeProfit,
            reduceOnly: true,
          });
          console.log('롱 테이크프로핏 설정 완료:', longTakeProfitOrder);

          // 테이크프로핏 주문 내역 저장
          addOrder({
            symbol,
            side: 'SELL',
            type: 'TAKE_PROFIT_MARKET',
            quantity: longQuantity,
            takeProfitPrice: longTakeProfit,
            status: 'pending',
            orderId: longTakeProfitOrder.orderId,
            isAutoTrading: true,
            pairId: longPairId,
          });
        } catch (error: any) {
          // -2021: Order would immediately trigger 에러는 경고만 로그
          if (error.message?.includes('-2021') || error.message?.includes('immediately trigger')) {
            console.warn('롱 테이크프로핏 주문 스킵 (가격 조건 불일치):', error.message);
          } else {
            console.error('롱 테이크프로핏 주문 실패:', error);
          }
        }
      }

      // 4. 숏 진입 리밋 주문 생성
      await delay(API_CALL_DELAY); // 롱과 숏 사이 딜레이
      const shortEntry = highChannelEntryPoints.shortEntry;
      const shortStopLoss = config.useStopLoss
        ? shortEntry * (1 + config.stopLossPercent / 100)
        : undefined;
      const shortTakeProfit = config.useTakeProfit
        ? shortEntry * (1 - config.takeProfitPercent / 100)
        : undefined;
      const shortQuantity = calculateQuantityFromPercentage(shortEntry);
      const shortPairId = `auto_short_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      console.log(`숏 리밋 주문 생성 중: 진입=${shortEntry.toFixed(2)}, 스탑로스=${shortStopLoss?.toFixed(2)}, 테이크프로핏=${shortTakeProfit?.toFixed(2)}, 수량=${shortQuantity.toFixed(4)}`);

      if (shortStopLoss) {
        const shortMetrics = calculateTradingMetrics(shortEntry, shortStopLoss, shortQuantity);
        console.log('숏 포지션 지표:', shortMetrics);
      }

      const shortOrder = await BinanceFuturesAPI.createLimitOrder(
        symbol,
        'SELL',
        shortQuantity,
        shortEntry
      );
      console.log('숏 리밋 주문 생성 완료:', shortOrder);

      // 주문 내역 저장
      addOrder({
        symbol,
        side: 'SELL',
        type: 'LIMIT',
        quantity: shortQuantity,
        price: shortEntry,
        status: 'pending',
        orderId: shortOrder.orderId,
        isAutoTrading: true,
        pairId: shortPairId,
      });

      // 숏 스탑로스 주문
      if (shortStopLoss) {
        try {
          await delay(API_CALL_DELAY); // API 호출 간 딜레이
          const shortStopOrder = await BinanceFuturesAPI.createOrder({
            symbol,
            side: 'BUY',
            type: 'STOP_MARKET',
            quantity: shortQuantity,
            stopPrice: shortStopLoss,
            reduceOnly: true,
          });
          console.log('숏 스탑로스 설정 완료:', shortStopOrder);

          // 스탑로스 주문 내역 저장
          addOrder({
            symbol,
            side: 'BUY',
            type: 'STOP_MARKET',
            quantity: shortQuantity,
            stopPrice: shortStopLoss,
            status: 'pending',
            orderId: shortStopOrder.orderId,
            isAutoTrading: true,
            pairId: shortPairId,
          });
        } catch (error: any) {
          // -2021: Order would immediately trigger 에러는 경고만 로그
          if (error.message?.includes('-2021') || error.message?.includes('immediately trigger')) {
            console.warn('숏 스탑로스 주문 스킵 (가격 조건 불일치):', error.message);
          } else {
            console.error('숏 스탑로스 주문 실패:', error);
          }
        }
      }

      // 숏 테이크프로핏 주문
      if (shortTakeProfit) {
        try {
          await delay(API_CALL_DELAY); // API 호출 간 딜레이
          const shortTakeProfitOrder = await BinanceFuturesAPI.createOrder({
            symbol,
            side: 'BUY',
            type: 'TAKE_PROFIT_MARKET',
            quantity: shortQuantity,
            stopPrice: shortTakeProfit,
            reduceOnly: true,
          });
          console.log('숏 테이크프로핏 설정 완료:', shortTakeProfitOrder);

          // 테이크프로핏 주문 내역 저장
          addOrder({
            symbol,
            side: 'BUY',
            type: 'TAKE_PROFIT_MARKET',
            quantity: shortQuantity,
            takeProfitPrice: shortTakeProfit,
            status: 'pending',
            orderId: shortTakeProfitOrder.orderId,
            isAutoTrading: true,
            pairId: shortPairId,
          });
        } catch (error: any) {
          // -2021: Order would immediately trigger 에러는 경고만 로그
          if (error.message?.includes('-2021') || error.message?.includes('immediately trigger')) {
            console.warn('숏 테이크프로핏 주문 스킵 (가격 조건 불일치):', error.message);
          } else {
            console.error('숏 테이크프로핏 주문 실패:', error);
          }
        }
      }

      console.log('=== 자동 거래 완료 ===');
      showSuccess('자동 거래 주문이 생성되었습니다.', '자동 거래');
    } catch (error: any) {
      console.error('자동 거래 실패:', error);
      showError(`자동 거래 실패: ${error.message}`);
    }
  };

  useEffect(() => {
    if (candlestickData.length === 0) return;

    const currentCandle = candlestickData[candlestickData.length - 1];
    const currentTime = currentCandle.time;

    // 초기화 시 (첫 로드)
    if (!isInitializedRef.current) {
      lastCandleTimeRef.current = currentTime;
      isInitializedRef.current = true;

      // 초기 자동 거래 실행 (설정이 활성화되어 있으면)
      if (config.enabled) {
        setTimeout(() => {
          executeAutoTrading();
        }, 2000); // 2초 후 실행 (데이터 로드 후)
      }

      return;
    }

    // 새로운 캔들 생성 감지 (1시간 정각)
    if (lastCandleTimeRef.current !== null && currentTime > lastCandleTimeRef.current) {
      console.log('새로운 캔들 감지! 자동 거래 실행...');
      console.log('이전 시간:', new Date(lastCandleTimeRef.current * 1000).toLocaleString());
      console.log('현재 시간:', new Date(currentTime * 1000).toLocaleString());

      lastCandleTimeRef.current = currentTime;

      // 자동 거래 실행
      if (config.enabled) {
        executeAutoTrading();
      }
    }
  }, [candlestickData, config, symbol, highChannelEntryPoints]);

  return {
    executeManually: executeAutoTrading,
    calculateTradingMetrics,
  };
};
