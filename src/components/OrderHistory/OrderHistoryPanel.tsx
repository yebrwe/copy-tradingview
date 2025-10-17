import { useEffect, useState } from 'react';
import { useOrderHistoryStore } from '../../store/orderHistoryStore';
import { useChartStore } from '../../store/chartStore';
import { useUserDataStream } from '../../hooks/useUserDataStream';
import { BinanceFuturesAPI } from '../../services/binanceFuturesAPI';
import type { OrderHistory } from '../../store/orderHistoryStore';

interface OrderPair {
  pairId: string;
  entryOrder: OrderHistory;
  stopLossOrder?: OrderHistory;
  takeProfitOrder?: OrderHistory;
  timestamp: number;
}

type TabType = 'positions' | 'openOrders' | 'history';

export const OrderHistoryPanel = () => {
  const { orders: historyOrders, loadFromStorage, clearHistory } = useOrderHistoryStore();
  const { symbol } = useChartStore();
  const [activeTab, setActiveTab] = useState<TabType>('positions');
  const [initialOrders, setInitialOrders] = useState<any[]>([]);
  const [hasFetchedInitialOrders, setHasFetchedInitialOrders] = useState(false);

  // 잔고 갱신 이벤트 발생
  const handleBalanceUpdate = () => {
    console.log('주문 상태 변경 감지 - 잔고 갱신 이벤트 발생');
    window.dispatchEvent(new CustomEvent('balance-update-required'));
  };

  // 주문 업데이트 이벤트 발생 (REST API 재조회)
  const handleOrderUpdate = async () => {
    console.log('주문 업데이트 감지 - REST API로 미체결 주문 재조회');
    try {
      const orders = await BinanceFuturesAPI.getOpenOrders(symbol);
      console.log('REST API 재조회 결과:', orders.length, '건');
      setInitialOrders(orders);
    } catch (err: any) {
      console.error('REST API 재조회 실패:', err);
    }
  };

  // WebSocket으로 실시간 포지션 수신 및 주문 업데이트 트리거
  const { positions, isConnected } = useUserDataStream({
    enabled: true,
    onBalanceUpdate: handleBalanceUpdate,
    onOrderUpdate: handleOrderUpdate,
  });

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  // 초기 미체결 주문 조회 (서버 재시작 또는 페이지 재진입 시)
  useEffect(() => {
    const fetchInitialOrders = async () => {
      // 이미 조회했으면 스킵 (심볼 변경 시는 재조회)
      if (hasFetchedInitialOrders) {
        return;
      }

      try {
        console.log('REST API로 미체결 주문 조회 중...');
        const orders = await BinanceFuturesAPI.getOpenOrders(symbol);
        console.log('REST API 조회 결과:', orders.length, '건', orders);
        setInitialOrders(orders);
        setHasFetchedInitialOrders(true);
      } catch (err: any) {
        console.error('미체결 주문 조회 실패:', err);
      }
    };

    // 컴포넌트 마운트 시 또는 심볼 변경 시 조회
    fetchInitialOrders();
  }, [symbol, hasFetchedInitialOrders]);

  // WebSocket 연결 후 REST API 재조회 (최신 데이터로 동기화)
  useEffect(() => {
    if (isConnected && hasFetchedInitialOrders) {
      const refreshOrders = async () => {
        try {
          console.log('WebSocket 연결 후 REST API 재조회...');
          const orders = await BinanceFuturesAPI.getOpenOrders(symbol);
          console.log('REST API 재조회 결과:', orders.length, '건');
          setInitialOrders(orders);
        } catch (err: any) {
          console.error('REST API 재조회 실패:', err);
        }
      };

      // WebSocket 연결 후 1초 뒤 재조회
      const timer = setTimeout(refreshOrders, 1000);
      return () => clearTimeout(timer);
    }
  }, [isConnected, symbol, hasFetchedInitialOrders]);

  // 심볼이 변경되면 초기 조회 플래그 리셋
  useEffect(() => {
    setHasFetchedInitialOrders(false);
    setInitialOrders([]);
  }, [symbol]);

  const handleCancelOrder = async (orderId: number) => {
    try {
      await BinanceFuturesAPI.cancelOrder(symbol, orderId);
    } catch (err: any) {
      alert(`주문 취소 실패: ${err.message}`);
    }
  };

  // 주문을 pairId로 그룹핑
  const groupOrdersByPair = (): OrderPair[] => {
    const pairMap = new Map<string, { entry?: OrderHistory; stopLoss?: OrderHistory; takeProfit?: OrderHistory }>();

    historyOrders.forEach((order) => {
      if (order.pairId) {
        const existing = pairMap.get(order.pairId) || {};
        if (order.type === 'LIMIT' || order.type === 'MARKET') {
          existing.entry = order;
        } else if (order.type === 'STOP_MARKET') {
          existing.stopLoss = order;
        } else if (order.type === 'TAKE_PROFIT_MARKET') {
          existing.takeProfit = order;
        }
        pairMap.set(order.pairId, existing);
      }
    });

    const pairs: OrderPair[] = [];
    pairMap.forEach((value, key) => {
      if (value.entry) {
        pairs.push({
          pairId: key,
          entryOrder: value.entry,
          stopLossOrder: value.stopLoss,
          takeProfitOrder: value.takeProfit,
          timestamp: value.entry.timestamp,
        });
      }
    });

    return pairs.sort((a, b) => b.timestamp - a.timestamp);
  };

  const orderPairs = groupOrdersByPair();

  // 현재 심볼의 포지션만 필터링
  const currentSymbolPositions = positions.filter(p => p.symbol === symbol);

  // REST API로 조회한 미체결 주문만 사용 (WebSocket은 트리거로만 사용)
  const currentSymbolOrders = initialOrders
    .filter(order => order.symbol === symbol)
    .filter(order => order.status === 'NEW' || order.status === 'PARTIALLY_FILLED');

  console.log('미체결 주문:', {
    total: initialOrders.length,
    currentSymbol: currentSymbolOrders.length,
  });

  return (
    <div className="bg-[#1e222d] rounded-lg overflow-hidden border border-[#2a2e39]">
      {/* 탭 헤더 */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-[#2a2e39]">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('positions')}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'positions'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-[#2a2e39]'
            }`}
          >
            포지션
            {currentSymbolPositions.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-white/20 rounded">
                {currentSymbolPositions.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('openOrders')}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'openOrders'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-[#2a2e39]'
            }`}
          >
            미체결
            {currentSymbolOrders.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-white/20 rounded">
                {currentSymbolOrders.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'history'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-[#2a2e39]'
            }`}
          >
            내역
            {orderPairs.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-white/20 rounded">
                {orderPairs.length}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* WebSocket 연결 상태 */}
          <div className={`flex items-center gap-1.5 text-xs ${isConnected ? 'text-green-400' : 'text-gray-500'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
            <span className="font-medium">{isConnected ? 'Live' : 'Offline'}</span>
          </div>

          {activeTab === 'history' && orderPairs.length > 0 && (
            <button
              onClick={clearHistory}
              className="text-xs px-3 py-1 bg-[#2a2e39] text-gray-400 rounded-lg hover:bg-[#363a45] hover:text-white transition-colors font-medium"
            >
              전체삭제
            </button>
          )}
        </div>
      </div>

      {/* 탭 콘텐츠 */}
      <div className="p-2 max-h-[280px] overflow-y-auto custom-scrollbar">
        {/* 포지션 탭 */}
        {activeTab === 'positions' && (
          <>
            {currentSymbolPositions.length > 0 ? (
              <div className="space-y-1">
                {currentSymbolPositions.map((position, index) => {
                  const isLong = position.positionAmt > 0;
                  const pnlPercent = position.entryPrice > 0
                    ? ((position.unrealizedProfit / (position.entryPrice * Math.abs(position.positionAmt))) * 100)
                    : 0;
                  const markPrice = position.entryPrice + (position.unrealizedProfit / Math.abs(position.positionAmt));

                  return (
                    <div
                      key={index}
                      className="bg-[#131722] rounded px-2 py-1.5 border border-[#2a2e39] hover:border-[#363a45] transition-all"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-1.5 py-0.5 rounded font-bold ${
                            isLong ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                          }`}>
                            {isLong ? 'L' : 'S'}
                          </span>
                          <span className="text-gray-400">{position.leverage}x</span>
                          <span className="text-gray-500">|</span>
                          <span className="text-white">수량 {Math.abs(position.positionAmt).toFixed(3)}</span>
                          <span className="text-gray-500">|</span>
                          <span className="text-gray-400">진입 ${position.entryPrice.toFixed(2)}</span>
                          <span className="text-gray-500">|</span>
                          <span className={position.unrealizedProfit >= 0 ? 'text-green-400' : 'text-red-400'}>
                            마크 ${markPrice.toFixed(2)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className={`font-bold ${position.unrealizedProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {position.unrealizedProfit >= 0 ? '+' : ''}{position.unrealizedProfit.toFixed(2)} USDT
                          </span>
                          <span className={`ml-1.5 ${pnlPercent >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
                            ({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%)
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-gray-500 text-xs py-8">
                보유 포지션이 없습니다
              </div>
            )}
          </>
        )}

        {/* 미체결 주문 탭 */}
        {activeTab === 'openOrders' && (
          <>
            {currentSymbolOrders.length > 0 ? (
              <div className="space-y-1">
                {currentSymbolOrders.map((order) => {
                  const isLong = order.side === 'BUY';
                  const price = Number(order.price || order.stopPrice || 0);

                  return (
                    <div
                      key={order.orderId}
                      className="bg-[#131722] rounded px-2 py-1.5 border border-[#2a2e39] hover:border-[#363a45] transition-all"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-1.5 py-0.5 rounded font-bold ${
                            isLong ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                          }`}>
                            {isLong ? 'L' : 'S'}
                          </span>
                          <span className="text-gray-400">{order.type}</span>
                          <span className="text-gray-500">|</span>
                          <span className="text-white">${price.toFixed(2)}</span>
                          <span className="text-gray-500">|</span>
                          <span className="text-gray-400">수량 {Number(order.origQty).toFixed(3)}</span>
                        </div>
                        <button
                          onClick={() => handleCancelOrder(order.orderId)}
                          className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-gray-500 text-xs py-8">
                미체결 주문이 없습니다
              </div>
            )}
          </>
        )}

        {/* 주문 내역 탭 */}
        {activeTab === 'history' && (
          <>
            {orderPairs.length > 0 ? (
              <div className="space-y-1">
                {orderPairs.slice(0, 20).map((pair) => {
                  const isLong = pair.entryOrder.side === 'BUY';

                  return (
                    <div
                      key={pair.pairId}
                      className="bg-[#131722] rounded px-2 py-1.5 border border-[#2a2e39]"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-1.5 py-0.5 rounded font-bold ${
                            isLong ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                          }`}>
                            {isLong ? 'L' : 'S'}
                          </span>
                          {pair.entryOrder.isAutoTrading && (
                            <span className="px-1 py-0.5 bg-blue-500/20 text-blue-400 rounded font-medium">
                              A
                            </span>
                          )}
                          <span className="text-white">진입 ${pair.entryOrder.price?.toFixed(2)}</span>
                          <span className="text-gray-500">|</span>
                          <span className="text-orange-400">
                            SL {pair.stopLossOrder ? `$${pair.stopLossOrder.stopPrice?.toFixed(2)}` : '-'}
                          </span>
                          <span className="text-gray-500">|</span>
                          <span className="text-green-400">
                            TP {pair.takeProfitOrder ? `$${pair.takeProfitOrder.takeProfitPrice?.toFixed(2)}` : '-'}
                          </span>
                          <span className="text-gray-500">|</span>
                          <span className="text-gray-400">수량 {pair.entryOrder.quantity.toFixed(3)}</span>
                        </div>
                        <span className="text-gray-500">
                          {new Date(pair.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-gray-500 text-xs py-8">
                주문 내역이 없습니다
              </div>
            )}
          </>
        )}
      </div>

      {/* 스크롤바 스타일 */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #1e222d;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #2a2e39;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #363a45;
        }
      `}</style>
    </div>
  );
};
