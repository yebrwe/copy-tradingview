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
  const { symbol, candlestickData, checkChannelBreakout } = useChartStore();
  const { showError, showSuccess } = useToastStore();
  const { addOrder, loadFromStorage } = useOrderHistoryStore();
  const lastCandleTimeRef = useRef<number | null>(null);
  const isInitializedRef = useRef(false);
  const scheduledTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // 현재 캔들 시간 기준으로 주문이 있는지 체크
  const hasOrdersForCurrentCandle = (): boolean => {
    const { candlestickData } = useChartStore.getState();
    if (candlestickData.length === 0) return false;

    // 현재 캔들의 시작 시간 (초 단위)
    const currentCandleTime = candlestickData[candlestickData.length - 1].time;
    const currentCandleStartMs = currentCandleTime * 1000; // 밀리초로 변환

    // 주문 내역에서 현재 캔들 시간 이후에 생성된 자동거래 주문이 있는지 확인
    const { orders } = useOrderHistoryStore.getState();
    const hasRecentAutoOrders = orders.some(order => {
      return order.isAutoTrading &&
             order.timestamp >= currentCandleStartMs &&
             order.type === 'LIMIT'; // 진입 주문만 체크
    });

    if (hasRecentAutoOrders) {
      console.log('✓ 현재 캔들 기준 주문 내역 존재 (캔들 시간:', new Date(currentCandleStartMs).toLocaleString(), ')');
    } else {
      console.log('✗ 현재 캔들 기준 주문 내역 없음 (캔들 시간:', new Date(currentCandleStartMs).toLocaleString(), ')');
    }

    return hasRecentAutoOrders;
  };

  // 자동 거래 실행
  const executeAutoTrading = async () => {
    console.log('🔄 executeAutoTrading 함수 호출됨');

    if (!config.enabled) {
      console.log('❌ 자동 거래가 비활성화되어 있습니다.');
      return;
    }

    // 최신 상태를 store에서 직접 가져오기 (클로저 문제 해결)
    const currentState = useChartStore.getState();
    const currentRecommendedEntries = currentState.recommendedEntries;
    const currentChannelBreakout = currentState.channelBreakout;
    const currentChannelPattern = currentState.channelPattern;

    console.log('📊 현재 상태:', {
      추천진입점수: currentRecommendedEntries.length,
      채널돌파상태: currentChannelBreakout,
      채널패턴: currentChannelPattern,
    });

    // 채널 돌파 상태 확인
    if (currentChannelBreakout !== null) {
      console.log('🚫 채널 돌파 상태로 인해 자동 거래 중지:', currentChannelBreakout === 'upper' ? '상단 돌파' : '하단 돌파');
      console.log('💡 채널을 재설정(고점 연결 버튼)하여 돌파 상태를 초기화하세요.');
      showError('채널이 돌파되어 자동 거래가 중지되었습니다. 채널을 재설정하세요.', '자동 거래');
      return;
    }

    if (currentRecommendedEntries.length === 0) {
      console.log('❌ 추천 진입점이 없습니다.');
      return;
    }

    // 현재 캔들 기준 주문 내역 체크
    if (hasOrdersForCurrentCandle()) {
      console.log('현재 캔들 기준으로 이미 주문이 존재하여 자동 거래를 스킵합니다.');
      return;
    }

    console.log('=== 자동 거래 시작 ===');
    console.log('시간:', new Date().toLocaleString());
    console.log('채널 패턴:', currentChannelPattern);
    console.log('추천 진입점:', currentRecommendedEntries);

    try {
      // 1. 이전 미체결 주문 모두 취소
      console.log('이전 미체결 주문 취소 중...');
      await BinanceFuturesAPI.cancelAllOpenOrders(symbol);
      await delay(API_CALL_DELAY); // API 호출 간 딜레이

      // 2. 잔고 조회 (미체결 주문 취소 후)
      let currentBalance = config.balance;
      try {
        console.log('잔고 조회 중...');
        await delay(API_CALL_DELAY); // API 호출 간 딜레이
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

      // 3. 레버리지 설정
      await delay(API_CALL_DELAY); // API 호출 간 딜레이
      await BinanceFuturesAPI.setLeverage(symbol, config.leverage);

      // 4. 추천 진입점 기반 주문 생성
      for (const [index, entry] of currentRecommendedEntries.entries()) {
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

      // 자동 거래 완료 후 항상 잔고 갱신
      try {
        console.log('잔고 갱신 중...');
        await delay(API_CALL_DELAY); // API 호출 간 딜레이
        const balances = await BinanceFuturesAPI.getAccountBalance();
        const usdtBalance = balances.find((b: any) => b.asset === 'USDT');
        if (usdtBalance) {
          const updatedBalance = parseFloat(usdtBalance.availableBalance);
          console.log('갱신된 잔고:', updatedBalance, 'USDT');
          // 잔고 업데이트 콜백 호출
          if (config.onBalanceUpdate) {
            config.onBalanceUpdate(updatedBalance);
          }
        }
      } catch (error) {
        console.warn('잔고 갱신 실패:', error);
      }

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
      if (config.enabled) {
        setTimeout(() => {
          executeAutoTrading();
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

      // 자동 거래 실행 (5분 지연 - 캔들 갱신 시간 고려)
      if (config.enabled) {
        const delayMinutes = 5; // 5분 여유 (캔들 갱신 지연 고려)
        console.log(`${delayMinutes}분 후 자동 거래 실행 예정:`, new Date(Date.now() + delayMinutes * 60 * 1000).toLocaleString());
        scheduledTimerRef.current = setTimeout(() => {
          console.log('예약된 자동 거래 실행 시작');
          executeAutoTrading();
          scheduledTimerRef.current = null; // 타이머 실행 후 초기화
        }, delayMinutes * 60 * 1000); // 5분 = 300초 = 300000ms
      }
    }
    // 캔들 생성이 아니어도 주문 내역이 없으면 자동 거래 실행
    else if (config.enabled && !hasOrdersForCurrentCandle()) {
      // 이미 타이머가 실행 중이면 새로운 타이머를 설정하지 않음
      if (checkTimerRef.current) {
        console.log('⏳ 자동 거래 타이머가 이미 실행 중입니다.');
        return;
      }

      console.log('🔔 현재 캔들 기준 주문 내역 없음 - 5초 후 자동 거래 실행 예약');
      checkTimerRef.current = setTimeout(() => {
        console.log('⏰ 5초 타이머 완료 - 주문 내역 재확인 후 자동 거래 실행');
        if (!hasOrdersForCurrentCandle()) {
          executeAutoTrading();
        } else {
          console.log('⚠️ 재확인 결과 주문이 이미 존재함 - 자동 거래 스킵');
        }
        checkTimerRef.current = null;
      }, 5000); // 5초 후 재확인 후 실행
    }

    // cleanup: 컴포넌트 unmount 시 타이머 정리
    return () => {
      // 주의: 여기서 타이머를 취소하면 안됨 (effect가 재실행될 때마다 취소되어버림)
      // unmount 시에만 정리
    };
  }, [candlestickData, config.enabled]);

  // 컴포넌트 unmount 시 cleanup
  useEffect(() => {
    return () => {
      if (scheduledTimerRef.current) {
        clearTimeout(scheduledTimerRef.current);
        scheduledTimerRef.current = null;
      }
      if (checkTimerRef.current) {
        clearTimeout(checkTimerRef.current);
        checkTimerRef.current = null;
      }
    };
  }, []);

  return {
    executeManually: executeAutoTrading,
    calculateTradingMetrics,
  };
};
