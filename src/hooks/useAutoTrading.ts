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
  onBalanceUpdate?: (balance: number) => void;
}

// 바이낸스 선물 수수료율
const MAKER_FEE = 0.0002; // 0.02%
const TAKER_FEE = 0.0004; // 0.04%

// API 호출 간 딜레이 (밀리초)
const API_CALL_DELAY = 300; // 300ms
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 자동 거래 Hook
 * 1시간 캔들 생성 감지 후 10분 대기하여 다음 작업 수행:
 * 1. 잔고 조회 및 업데이트
 * 2. 레버리지 설정
 * 3. 이전 미체결 주문 취소
 * 4. 새로운 진입점에 리밋 주문 생성 (스탑로스, 테이크프로핏 포함)
 */
export const useAutoTrading = (config: AutoTradingConfig) => {
  const { symbol, candlestickData, highChannelEntryPoints, lowChannelEntryPoints, channelPattern, recommendedEntries, channelBreakout, checkChannelBreakout } = useChartStore();
  const { showError, showSuccess } = useToastStore();
  const { addOrder, loadFromStorage } = useOrderHistoryStore();
  const lastCandleTimeRef = useRef<number | null>(null);
  const isInitializedRef = useRef(false);
  const scheduledTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasCheckedInitialOrdersRef = useRef(false);

  // 비율 기반 수량 계산
  const calculateQuantityFromPercentage = (currentPrice: number, balance?: number): number => {
    const balanceToUse = balance || config.balance;

    if (!config.usePercentage || !balanceToUse) {
      return config.quantity;
    }

    const percentage = (config.accountPercentage || 10) / 100;
    const availableMargin = balanceToUse * percentage;
    const calculatedQty = (availableMargin * config.leverage) / currentPrice;

    console.log('비율 기반 수량 계산:', {
      balance: balanceToUse,
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

    // 채널 돌파 상태 확인
    if (channelBreakout !== null) {
      console.log('🚫 채널 돌파 상태로 인해 자동 거래 중지:', channelBreakout === 'upper' ? '상단 돌파' : '하단 돌파');
      console.log('💡 채널을 재설정(고점 연결 버튼)하여 돌파 상태를 초기화하세요.');
      showError('채널이 돌파되어 자동 거래가 중지되었습니다. 채널을 재설정하세요.', '자동 거래');
      return;
    }

    if (recommendedEntries.length === 0) {
      console.log('추천 진입점이 없습니다.');
      return;
    }

    console.log('=== 자동 거래 시작 ===');
    console.log('시간:', new Date().toLocaleString());
    console.log('채널 패턴:', channelPattern);
    console.log('추천 진입점:', recommendedEntries);

    try {
      // 1. 잔고 조회 (수량 계산에 사용)
      let currentBalance = config.balance;
      if (config.usePercentage) {
        try {
          console.log('잔고 조회 중...');
          const balances = await BinanceFuturesAPI.getAccountBalance();
          const usdtBalance = balances.find((b: any) => b.asset === 'USDT');
          if (usdtBalance) {
            currentBalance = parseFloat(usdtBalance.availableBalance);
            console.log('현재 잔고:', currentBalance, 'USDT');
            // 잔고 업데이트 콜백 호출
            if (config.onBalanceUpdate) {
              config.onBalanceUpdate(currentBalance);
            }
          }
        } catch (error) {
          console.warn('잔고 조회 실패, 기존 값 사용:', error);
        }
      }

      // 2. 레버리지 설정
      await BinanceFuturesAPI.setLeverage(symbol, config.leverage);

      // 3. 이전 미체결 주문 모두 취소
      console.log('이전 미체결 주문 취소 중...');
      await BinanceFuturesAPI.cancelAllOpenOrders(symbol);

      // 4. 추천 진입점 기반 주문 생성
      for (const [index, entry] of recommendedEntries.entries()) {
        if (index > 0) {
          await delay(API_CALL_DELAY); // 주문 간 딜레이
        }

        const entryPrice = entry.price;
        const side = entry.type === 'long' ? 'BUY' : 'SELL';
        const oppositeSide = entry.type === 'long' ? 'SELL' : 'BUY';

        // 스탑로스 & 테이크프로핏 계산
        const stopLoss = config.useStopLoss
          ? (entry.type === 'long'
              ? entryPrice * (1 - config.stopLossPercent / 100)
              : entryPrice * (1 + config.stopLossPercent / 100))
          : undefined;

        const takeProfit = config.useTakeProfit
          ? (entry.type === 'long'
              ? entryPrice * (1 + config.takeProfitPercent / 100)
              : entryPrice * (1 - config.takeProfitPercent / 100))
          : undefined;

        const quantity = calculateQuantityFromPercentage(entryPrice, currentBalance);
        const pairId = `auto_${entry.type}_${entry.channel}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        console.log(`[${entry.type.toUpperCase()} ${entry.channel.toUpperCase()}] 리밋 주문 생성 중: 진입=${entryPrice.toFixed(2)}, 스탑로스=${stopLoss?.toFixed(2)}, 테이크프로핏=${takeProfit?.toFixed(2)}, 수량=${quantity.toFixed(4)}`);

        if (stopLoss) {
          const metrics = calculateTradingMetrics(entryPrice, stopLoss, quantity);
          console.log(`[${entry.type.toUpperCase()} ${entry.channel.toUpperCase()}] 포지션 지표:`, metrics);
        }

        // 진입 주문 생성
        const entryOrder = await BinanceFuturesAPI.createLimitOrder(
          symbol,
          side as 'BUY' | 'SELL',
          quantity,
          entryPrice
        );
        console.log(`[${entry.type.toUpperCase()} ${entry.channel.toUpperCase()}] 리밋 주문 생성 완료:`, entryOrder);

        // 주문 내역 저장
        addOrder({
          symbol,
          side: side as 'BUY' | 'SELL',
          type: 'LIMIT',
          quantity,
          price: entryPrice,
          status: 'pending',
          orderId: entryOrder.orderId,
          isAutoTrading: true,
          pairId,
        });

        // 스탑로스 주문
        if (stopLoss) {
          try {
            await delay(API_CALL_DELAY);
            const stopOrder = await BinanceFuturesAPI.createOrder({
              symbol,
              side: oppositeSide as 'BUY' | 'SELL',
              type: 'STOP_MARKET',
              quantity,
              stopPrice: stopLoss,
              reduceOnly: true,
            });
            console.log(`[${entry.type.toUpperCase()} ${entry.channel.toUpperCase()}] 스탑로스 설정 완료:`, stopOrder);

            addOrder({
              symbol,
              side: oppositeSide as 'BUY' | 'SELL',
              type: 'STOP_MARKET',
              quantity,
              stopPrice: stopLoss,
              status: 'pending',
              orderId: stopOrder.orderId,
              isAutoTrading: true,
              pairId,
            });
          } catch (error: any) {
            if (error.message?.includes('-2021') || error.message?.includes('immediately trigger')) {
              console.warn(`[${entry.type.toUpperCase()} ${entry.channel.toUpperCase()}] 스탑로스 주문 스킵 (가격 조건 불일치):`, error.message);
            } else {
              console.error(`[${entry.type.toUpperCase()} ${entry.channel.toUpperCase()}] 스탑로스 주문 실패:`, error);
            }
          }
        }

        // 테이크프로핏 주문
        if (takeProfit) {
          try {
            await delay(API_CALL_DELAY);
            const takeProfitOrder = await BinanceFuturesAPI.createOrder({
              symbol,
              side: oppositeSide as 'BUY' | 'SELL',
              type: 'TAKE_PROFIT_MARKET',
              quantity,
              stopPrice: takeProfit,
              reduceOnly: true,
            });
            console.log(`[${entry.type.toUpperCase()} ${entry.channel.toUpperCase()}] 테이크프로핏 설정 완료:`, takeProfitOrder);

            addOrder({
              symbol,
              side: oppositeSide as 'BUY' | 'SELL',
              type: 'TAKE_PROFIT_MARKET',
              quantity,
              takeProfitPrice: takeProfit,
              status: 'pending',
              orderId: takeProfitOrder.orderId,
              isAutoTrading: true,
              pairId,
            });
          } catch (error: any) {
            if (error.message?.includes('-2021') || error.message?.includes('immediately trigger')) {
              console.warn(`[${entry.type.toUpperCase()} ${entry.channel.toUpperCase()}] 테이크프로핏 주문 스킵 (가격 조건 불일치):`, error.message);
            } else {
              console.error(`[${entry.type.toUpperCase()} ${entry.channel.toUpperCase()}] 테이크프로핏 주문 실패:`, error);
            }
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

    // 채널 돌파 상태 확인 (매 캔들 업데이트마다)
    checkChannelBreakout();

    // 초기화 시 (첫 로드)
    if (!isInitializedRef.current) {
      lastCandleTimeRef.current = currentTime;
      isInitializedRef.current = true;

      // localStorage에서 주문 내역 로드
      loadFromStorage();

      // 초기 자동 거래 실행 (설정이 활성화되어 있으면)
      if (config.enabled && !hasCheckedInitialOrdersRef.current) {
        hasCheckedInitialOrdersRef.current = true;

        setTimeout(() => {
          // 최신 orders 상태를 가져오기 위해 store에서 직접 조회
          const currentOrders = useOrderHistoryStore.getState().orders;

          // 현재 캔들 시간대에 주문이 있는지 확인 (1시간봉 기준)
          const candleStartTime = currentTime * 1000; // 초 → 밀리초
          const candleEndTime = candleStartTime + 60 * 60 * 1000; // 1시간 후

          // 현재 캔들 시간대의 자동 거래 주문 확인
          const ordersInCurrentCandle = currentOrders.filter(order =>
            order.isAutoTrading &&
            order.timestamp >= candleStartTime &&
            order.timestamp < candleEndTime &&
            order.type === 'LIMIT' // 진입 주문만 확인
          );

          if (ordersInCurrentCandle.length === 0) {
            console.log('📋 현재 캔들 시간대에 주문 없음 - 자동 거래 실행');
            console.log('현재 캔들 시간:', new Date(candleStartTime).toLocaleString());
            console.log('캔들 범위:', new Date(candleStartTime).toLocaleString(), '~', new Date(candleEndTime).toLocaleString());
            console.log('전체 주문 수:', currentOrders.length);
            executeAutoTrading();
          } else {
            console.log('✅ 현재 캔들 시간대에 이미 주문 존재 - 자동 거래 스킵');
            console.log('현재 캔들 시간:', new Date(candleStartTime).toLocaleString());
            console.log('캔들 범위:', new Date(candleStartTime).toLocaleString(), '~', new Date(candleEndTime).toLocaleString());
            console.log('기존 주문 수:', ordersInCurrentCandle.length);
            console.log('기존 주문:', ordersInCurrentCandle);
          }
        }, 2000); // 2초 후 실행 (데이터 로드 후)
      }

      return;
    }

    // 새로운 캔들 생성 감지 (1시간 정각)
    if (lastCandleTimeRef.current !== null && currentTime > lastCandleTimeRef.current) {
      console.log('새로운 캔들 감지! 10분 후 자동 거래 실행 예약...');
      console.log('이전 시간:', new Date(lastCandleTimeRef.current * 1000).toLocaleString());
      console.log('현재 시간:', new Date(currentTime * 1000).toLocaleString());

      lastCandleTimeRef.current = currentTime;

      // 이전 타이머가 있으면 취소
      if (scheduledTimerRef.current) {
        console.log('이전 타이머 취소');
        clearTimeout(scheduledTimerRef.current);
        scheduledTimerRef.current = null;
      }

      // 자동 거래 실행 (10분 지연 - 새로운 캔들이 충분히 형성된 후)
      if (config.enabled) {
        const delayMinutes = 10;
        console.log(`${delayMinutes}분 후 자동 거래 실행 예정:`, new Date(Date.now() + delayMinutes * 60 * 1000).toLocaleString());
        scheduledTimerRef.current = setTimeout(() => {
          console.log('예약된 자동 거래 실행 시작');
          executeAutoTrading();
          scheduledTimerRef.current = null; // 타이머 실행 후 초기화
        }, delayMinutes * 60 * 1000); // 10분 = 600초 = 600000ms
      }
    }

    // cleanup: 컴포넌트 unmount 또는 effect 재실행 시 타이머 정리
    return () => {
      if (scheduledTimerRef.current) {
        clearTimeout(scheduledTimerRef.current);
        scheduledTimerRef.current = null;
      }
    };
  }, [candlestickData, config.enabled]);

  return {
    executeManually: executeAutoTrading,
    calculateTradingMetrics,
  };
};
