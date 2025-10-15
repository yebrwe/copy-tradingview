import { useEffect } from 'react';
import { useOrderHistoryStore } from '../../store/orderHistoryStore';
import type { OrderHistory } from '../../store/orderHistoryStore';

interface OrderPair {
  pairId: string;
  entryOrder: OrderHistory;
  stopLossOrder?: OrderHistory;
  timestamp: number;
}

export const OrderHistoryPanel = () => {
  const { orders, loadFromStorage, clearHistory } = useOrderHistoryStore();

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  // 주문을 pairId로 그룹핑
  const groupOrdersByPair = (): OrderPair[] => {
    const pairMap = new Map<string, { entry?: OrderHistory; stopLoss?: OrderHistory }>();

    orders.forEach((order) => {
      if (order.pairId) {
        const existing = pairMap.get(order.pairId) || {};
        if (order.type === 'LIMIT' || order.type === 'MARKET') {
          existing.entry = order;
        } else if (order.type === 'STOP_MARKET') {
          existing.stopLoss = order;
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
          timestamp: value.entry.timestamp,
        });
      }
    });

    // 최신순으로 정렬
    return pairs.sort((a, b) => b.timestamp - a.timestamp);
  };

  const orderPairs = groupOrdersByPair();

  return (
    <div className="bg-gray-800 p-4 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">주문 내역</h3>
        {orders.length > 0 && (
          <button
            onClick={clearHistory}
            className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
          >
            전체 삭제
          </button>
        )}
      </div>

      {orderPairs.length > 0 ? (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {orderPairs.slice(0, 20).map((pair) => {
            const isLong = pair.entryOrder.side === 'BUY';
            const chipColor = isLong ? 'bg-green-600' : 'bg-red-600';
            const chipText = isLong ? 'LONG' : 'SHORT';

            return (
              <div
                key={pair.pairId}
                className="bg-gray-700 rounded p-3 text-sm flex items-center gap-3"
              >
                {/* 롱/숏 칩 */}
                <div className={`${chipColor} px-2 py-1 rounded text-white text-xs font-bold min-w-[50px] text-center`}>
                  {chipText}
                </div>

                {/* 주문 정보 */}
                <div className="flex-1 grid grid-cols-3 gap-2">
                  <div>
                    <div className="text-gray-400 text-xs">진입</div>
                    <div className="text-white font-semibold">
                      ${pair.entryOrder.price?.toFixed(2)}
                    </div>
                  </div>

                  {pair.stopLossOrder && (
                    <div>
                      <div className="text-gray-400 text-xs">스탑로스</div>
                      <div className="text-orange-400 font-semibold">
                        ${pair.stopLossOrder.stopPrice?.toFixed(2)}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="text-gray-400 text-xs">수량</div>
                    <div className="text-white">
                      {pair.entryOrder.quantity.toFixed(4)}
                    </div>
                  </div>
                </div>

                {/* 자동 거래 태그 */}
                {pair.entryOrder.isAutoTrading && (
                  <div className="text-xs bg-blue-600 px-2 py-1 rounded text-white">
                    AUTO
                  </div>
                )}

                {/* 시간 */}
                <div className="text-gray-500 text-xs min-w-[60px] text-right">
                  {new Date(pair.timestamp).toLocaleTimeString()}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center text-gray-500 text-sm py-8">
          주문 내역이 없습니다
        </div>
      )}
    </div>
  );
};
