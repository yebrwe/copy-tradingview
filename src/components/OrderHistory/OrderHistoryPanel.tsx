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

  // WebSocket으로 실시간 포지션 및 미체결 주문 수신
  const { positions, orders: openOrders, isConnected } = useUserDataStream({
    enabled: true,
    onBalanceUpdate: handleBalanceUpdate,
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
        const orders = await BinanceFuturesAPI.getOpenOrders(symbol);
        setInitialOrders(orders);
        setHasFetchedInitialOrders(true);
      } catch (err: any) {
        // Silently handle errors
      }
    };

    // 컴포넌트 마운트 시 또는 심볼 변경 시 조회
    fetchInitialOrders();
  }, [symbol, hasFetchedInitialOrders]);

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

  // WebSocket 주문과 초기 조회 주문 병합
  // WebSocket 데이터가 있으면 우선 사용하고, 없으면 초기 조회 데이터 사용
  let mergedOrders: any[];

  if (openOrders.length > 0) {
    // WebSocket으로 주문 업데이트를 받았으면, WebSocket 데이터만 사용
    // (체결/취소된 주문은 이미 openOrders에서 제거되었음)
    mergedOrders = openOrders;
  } else if (isConnected && initialOrders.length === 0) {
    // WebSocket 연결되었고 initialOrders도 없으면 미체결 주문이 없는 것
    mergedOrders = [];
  } else {
    // WebSocket 연결 전이거나 아직 업데이트를 받지 못한 경우: 초기 조회 데이터 사용
    mergedOrders = initialOrders;
  }

  const currentSymbolOrders = mergedOrders.filter(o => o.symbol === symbol);

  return (
    <div className="bg-[#1e222d] rounded-lg overflow-hidden border border-[#2a2e39]">
      {/* 탭 헤더 */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-[#2a2e39]">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('positions')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeTab === 'positions'
                ? 'bg-[#2962ff] text-white shadow-lg shadow-blue-500/20'
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
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeTab === 'openOrders'
                ? 'bg-[#2962ff] text-white shadow-lg shadow-blue-500/20'
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
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeTab === 'history'
                ? 'bg-[#2962ff] text-white shadow-lg shadow-blue-500/20'
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
            <span>{isConnected ? 'Live' : 'Offline'}</span>
          </div>

          {activeTab === 'history' && orderPairs.length > 0 && (
            <button
              onClick={clearHistory}
              className="text-xs px-2.5 py-1 bg-[#2a2e39] text-gray-400 rounded hover:bg-[#363a45] hover:text-white transition-colors"
            >
              전체삭제
            </button>
          )}
        </div>
      </div>

      {/* 탭 콘텐츠 */}
      <div className="p-3 space-y-2 max-h-[280px] overflow-y-auto custom-scrollbar">
        {/* 포지션 탭 */}
        {activeTab === 'positions' && (
          <>
            {currentSymbolPositions.length > 0 ? (
              currentSymbolPositions.map((position, index) => {
                const isLong = position.positionAmt > 0;
                const pnlPercent = position.entryPrice > 0
                  ? ((position.unrealizedProfit / (position.entryPrice * Math.abs(position.positionAmt))) * 100)
                  : 0;

                return (
                  <div
                    key={index}
                    className="bg-[#131722] rounded-lg p-3 border border-[#2a2e39] hover:border-[#363a45] transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`px-2 py-0.5 rounded text-xs font-bold ${
                          isLong ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {isLong ? 'LONG' : 'SHORT'}
                        </div>
                        <div className="text-white font-semibold text-sm">{position.symbol}</div>
                        <div className="px-1.5 py-0.5 bg-[#2a2e39] rounded text-xs text-gray-400">
                          {position.leverage}x
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-bold ${position.unrealizedProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {position.unrealizedProfit >= 0 ? '+' : ''}{position.unrealizedProfit.toFixed(2)} USDT
                        </div>
                        <div className={`text-xs ${pnlPercent >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
                          {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <div className="text-gray-500 mb-0.5">수량</div>
                        <div className="text-white font-medium">{Math.abs(position.positionAmt).toFixed(4)}</div>
                      </div>
                      <div>
                        <div className="text-gray-500 mb-0.5">진입가</div>
                        <div className="text-white font-medium">${position.entryPrice.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-gray-500 mb-0.5">마크가</div>
                        <div className={`font-medium ${
                          isLong
                            ? position.unrealizedProfit >= 0 ? 'text-green-400' : 'text-red-400'
                            : position.unrealizedProfit >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          ${(position.entryPrice + (position.unrealizedProfit / Math.abs(position.positionAmt))).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center text-gray-500 text-sm py-12">
                보유 포지션이 없습니다
              </div>
            )}
          </>
        )}

        {/* 미체결 주문 탭 */}
        {activeTab === 'openOrders' && (
          <>
            {currentSymbolOrders.length > 0 ? (
              currentSymbolOrders.map((order) => {
                const isLong = order.side === 'BUY';
                const price = Number(order.price || order.stopPrice || 0);

                return (
                  <div
                    key={order.orderId}
                    className="bg-[#131722] rounded-lg p-3 border border-[#2a2e39] hover:border-[#363a45] transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`px-2 py-0.5 rounded text-xs font-bold ${
                            isLong ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                          }`}>
                            {isLong ? 'LONG' : 'SHORT'}
                          </div>
                          <div className="px-1.5 py-0.5 bg-[#2a2e39] rounded text-xs text-gray-400">
                            {order.type}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <div className="text-gray-500 mb-0.5">가격</div>
                            <div className="text-white font-semibold">${Number(price).toFixed(2)}</div>
                          </div>
                          <div>
                            <div className="text-gray-500 mb-0.5">수량</div>
                            <div className="text-white font-medium">{Number(order.origQty).toFixed(4)}</div>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleCancelOrder(order.orderId)}
                        className="ml-3 px-3 py-1.5 bg-red-500/20 text-red-400 text-xs font-medium rounded hover:bg-red-500/30 transition-colors"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center text-gray-500 text-sm py-12">
                미체결 주문이 없습니다
              </div>
            )}
          </>
        )}

        {/* 주문 내역 탭 */}
        {activeTab === 'history' && (
          <>
            {orderPairs.length > 0 ? (
              orderPairs.slice(0, 20).map((pair) => {
                const isLong = pair.entryOrder.side === 'BUY';

                return (
                  <div
                    key={pair.pairId}
                    className="bg-[#131722] rounded-lg p-3 border border-[#2a2e39]"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`px-2 py-0.5 rounded text-xs font-bold ${
                        isLong ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {isLong ? 'LONG' : 'SHORT'}
                      </div>
                      {pair.entryOrder.isAutoTrading && (
                        <div className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs font-medium">
                          AUTO
                        </div>
                      )}
                      <div className="text-gray-500 text-xs ml-auto">
                        {new Date(pair.timestamp).toLocaleTimeString()}
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div>
                        <div className="text-gray-500 mb-0.5">진입</div>
                        <div className="text-white font-semibold">
                          ${pair.entryOrder.price?.toFixed(2)}
                        </div>
                      </div>

                      <div>
                        <div className="text-gray-500 mb-0.5">SL</div>
                        {pair.stopLossOrder ? (
                          <div className="text-orange-400 font-semibold">
                            ${pair.stopLossOrder.stopPrice?.toFixed(2)}
                          </div>
                        ) : (
                          <div className="text-gray-600">-</div>
                        )}
                      </div>

                      <div>
                        <div className="text-gray-500 mb-0.5">TP</div>
                        {pair.takeProfitOrder ? (
                          <div className="text-green-400 font-semibold">
                            ${pair.takeProfitOrder.takeProfitPrice?.toFixed(2)}
                          </div>
                        ) : (
                          <div className="text-gray-600">-</div>
                        )}
                      </div>

                      <div>
                        <div className="text-gray-500 mb-0.5">수량</div>
                        <div className="text-white font-medium">
                          {pair.entryOrder.quantity.toFixed(4)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center text-gray-500 text-sm py-12">
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
