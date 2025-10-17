import { useEffect, useRef, useState } from 'react';
import { BinanceFuturesAPI } from '../services/binanceFuturesAPI';
import { notificationService } from '../services/notificationService';

const BINANCE_WS_BASE_URL = 'wss://fstream.binance.com';

interface Position {
  symbol: string;
  positionAmt: number;
  entryPrice: number;
  unrealizedProfit: number;
  leverage: number;
  positionSide: 'BOTH' | 'LONG' | 'SHORT';
  updateTime: number;
}

interface Order {
  symbol: string;
  orderId: number;
  clientOrderId: string;
  price: number;
  origQty: number;
  executedQty: number;
  status: string;
  type: string;
  side: 'BUY' | 'SELL';
  stopPrice?: number;
  updateTime: number;
}

interface UserDataStreamHook {
  positions: Position[];
  isConnected: boolean;
  error: string | null;
}

interface UserDataStreamOptions {
  enabled: boolean;
  onBalanceUpdate?: () => void;
  onOrderUpdate?: () => void; // 주문 업데이트 콜백 (REST API 재조회 트리거)
}

/**
 * 바이낸스 User Data Stream Hook
 * 실시간으로 포지션 및 주문 정보를 WebSocket으로 수신
 */
export const useUserDataStream = (options: UserDataStreamOptions | boolean): UserDataStreamHook => {
  // 하위 호환성: boolean 입력도 지원
  const config = typeof options === 'boolean'
    ? { enabled: options, onBalanceUpdate: undefined }
    : options;

  const { enabled, onBalanceUpdate, onOrderUpdate } = config;
  const [positions, setPositions] = useState<Position[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const listenKeyRef = useRef<string | null>(null);
  const keepAliveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const MAX_RECONNECT_ATTEMPTS = 5;
  const KEEP_ALIVE_INTERVAL = 30 * 60 * 1000; // 30분마다 listenKey 갱신

  // WebSocket 연결
  const connect = async () => {
    if (!enabled) return;

    try {
      console.log('User Data Stream 연결 시작...');

      // API credentials 설정 대기 (최대 5초)
      let retries = 0;
      const maxRetries = 10;
      while (retries < maxRetries) {
        try {
          // listenKey 생성 시도 (API credentials가 설정되어 있어야 성공)
          const listenKey = await BinanceFuturesAPI.createListenKey();
          listenKeyRef.current = listenKey;
          console.log('Listen Key 생성 완료:', listenKey);
          break; // 성공하면 while 루프 탈출
        } catch (error: any) {
          if (error.message?.includes('API credentials not set') && retries < maxRetries - 1) {
            console.log(`API credentials 대기 중... (${retries + 1}/${maxRetries})`);
            retries++;
            await new Promise(resolve => setTimeout(resolve, 500)); // 500ms 대기
            continue;
          }
          throw error; // 다른 에러이거나 최대 재시도 횟수 도달 시 throw
        }
      }

      if (!listenKeyRef.current) {
        throw new Error('Listen Key 생성 실패: API credentials가 설정되지 않았습니다.');
      }

      // WebSocket 연결
      const ws = new WebSocket(`${BINANCE_WS_BASE_URL}/ws/${listenKeyRef.current}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('User Data Stream 연결 성공');
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;

        // listenKey 갱신 타이머 설정
        if (keepAliveIntervalRef.current) {
          clearInterval(keepAliveIntervalRef.current);
        }
        keepAliveIntervalRef.current = setInterval(async () => {
          try {
            await BinanceFuturesAPI.keepAliveListenKey();
            console.log('Listen Key 갱신 완료');
          } catch (error) {
            console.error('Listen Key 갱신 실패:', error);
          }
        }, KEEP_ALIVE_INTERVAL);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('User Data Stream 메시지:', data);

          // ACCOUNT_UPDATE 이벤트: 포지션 업데이트
          if (data.e === 'ACCOUNT_UPDATE') {
            const updatedPositions = data.a.P.map((p: any) => ({
              symbol: p.s,
              positionAmt: parseFloat(p.pa),
              entryPrice: parseFloat(p.ep),
              unrealizedProfit: parseFloat(p.up),
              leverage: parseInt(p.l || '1'),
              positionSide: p.ps,
              updateTime: data.E,
            })).filter((p: Position) => Math.abs(p.positionAmt) > 0); // 포지션이 있는 것만

            setPositions(updatedPositions);
          }

          // ORDER_TRADE_UPDATE 이벤트: 주문 업데이트 (트리거만 사용)
          if (data.e === 'ORDER_TRADE_UPDATE') {
            const orderUpdate = data.o;
            console.log(`주문 업데이트 감지: ${orderUpdate.X} (orderId: ${orderUpdate.i})`);

            // 주문 업데이트 감지 시 콜백 호출 (REST API 재조회 트리거)
            if (onOrderUpdate) {
              onOrderUpdate();
            }

            // 부분 체결 또는 완전 체결 시 잔고 갱신
            if (orderUpdate.X === 'PARTIALLY_FILLED' || orderUpdate.X === 'FILLED') {
              if (onBalanceUpdate) {
                console.log(`주문 ${orderUpdate.X} 감지 - 잔고 갱신`);
                onBalanceUpdate();
              }
            }

            // 완전 체결 시 알림 전송 (진입/청산 구분)
            if (orderUpdate.X === 'FILLED') {
              const orderType = orderUpdate.o; // LIMIT, MARKET, STOP_MARKET, TAKE_PROFIT_MARKET 등

              // 진입 주문 체결 (LIMIT, MARKET)
              if (orderType === 'LIMIT' || orderType === 'MARKET') {
                console.log('🔔 포지션 진입 알림 전송');
                notificationService.notifyPositionOpened({
                  symbol: orderUpdate.s,
                  side: orderUpdate.S === 'BUY' ? 'LONG' : 'SHORT',
                  entryPrice: parseFloat(orderUpdate.ap || orderUpdate.p),
                  quantity: parseFloat(orderUpdate.q),
                  leverage: 1, // WebSocket에서는 레버리지 정보가 없음 (기본값)
                  timestamp: data.E,
                });
              }
              // 손절 체결 (STOP_MARKET)
              else if (orderType === 'STOP_MARKET') {
                console.log('🔔 손절 청산 알림 전송');
                notificationService.notifyPositionClosed(
                  orderUpdate.s,
                  0, // 실제 PNL은 계산 필요 (여기서는 0으로)
                  0, // 실제 PNL%는 계산 필요
                  'stop_loss'
                );
              }
              // 익절 체결 (TAKE_PROFIT_MARKET)
              else if (orderType === 'TAKE_PROFIT_MARKET') {
                console.log('🔔 익절 청산 알림 전송');
                notificationService.notifyPositionClosed(
                  orderUpdate.s,
                  0, // 실제 PNL은 계산 필요 (여기서는 0으로)
                  0, // 실제 PNL%는 계산 필요
                  'take_profit'
                );
              }
              // 기타 주문 타입
              else {
                console.log('🔔 주문 체결 알림 전송');
                notificationService.notifyOrderFilled({
                  symbol: orderUpdate.s,
                  side: orderUpdate.S,
                  type: orderUpdate.o,
                  price: parseFloat(orderUpdate.ap || orderUpdate.p),
                  quantity: parseFloat(orderUpdate.q),
                  status: orderUpdate.X,
                  timestamp: data.E,
                });
              }
            }
          }
        } catch (error) {
          console.error('User Data Stream 메시지 파싱 오류:', error);
        }
      };

      ws.onerror = (event) => {
        console.error('User Data Stream 오류:', event);
        setError('WebSocket 오류가 발생했습니다.');
      };

      ws.onclose = (event) => {
        console.log('User Data Stream 연결 종료:', event.code, event.reason);
        setIsConnected(false);

        // 재연결 시도
        if (enabled && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          console.log(`${delay}ms 후 재연결 시도 (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
          setError('최대 재연결 횟수를 초과했습니다.');
        }
      };

    } catch (error: any) {
      console.error('User Data Stream 연결 실패:', error);
      setError(`연결 실패: ${error.message}`);
      setIsConnected(false);
    }
  };

  // WebSocket 연결 해제
  const disconnect = async () => {
    console.log('User Data Stream 연결 해제...');

    // 타이머 정리
    if (keepAliveIntervalRef.current) {
      clearInterval(keepAliveIntervalRef.current);
      keepAliveIntervalRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // WebSocket 닫기
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // listenKey 삭제
    if (listenKeyRef.current) {
      try {
        await BinanceFuturesAPI.deleteListenKey();
        console.log('Listen Key 삭제 완료');
      } catch (error) {
        console.error('Listen Key 삭제 실패:', error);
      }
      listenKeyRef.current = null;
    }

    setIsConnected(false);
    setPositions([]);
  };

  // enabled 상태에 따라 연결/해제
  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled]);

  return {
    positions,
    isConnected,
    error,
  };
};
