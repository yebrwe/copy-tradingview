import { useState } from 'react';
import { BinanceFuturesAPI } from '../../services/binanceFuturesAPI';
import { useChartStore } from '../../store/chartStore';
import { useAutoTrading } from '../../hooks/useAutoTrading';

export const TradingPanel = () => {
  const { symbol, highChannelEntryPoints } = useChartStore();

  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [isApiConfigured, setIsApiConfigured] = useState(false);
  const [quantity, setQuantity] = useState('0.01');
  const [leverage, setLeverage] = useState('10');
  const [stopLossPercent, setStopLossPercent] = useState('5'); // 스탑로스 %
  const [useStopLoss, setUseStopLoss] = useState(true);
  const [stopLossOffset, setStopLossOffset] = useState('5'); // 스탑로스 오프셋 %
  const [isAutoTradingEnabled, setIsAutoTradingEnabled] = useState(false);
  const [isTrading, setIsTrading] = useState(false);

  // 자동 거래 Hook
  const { executeManually, calculateTradingMetrics } = useAutoTrading({
    enabled: isAutoTradingEnabled && isApiConfigured,
    leverage: parseInt(leverage),
    quantity: parseFloat(quantity),
    stopLossPercent: parseFloat(stopLossPercent),
  });

  // API 자격 증명 설정
  const handleConfigureApi = () => {
    if (!apiKey || !apiSecret) {
      alert('API Key와 Secret을 입력해주세요.');
      return;
    }

    BinanceFuturesAPI.setApiCredentials(apiKey, apiSecret);
    setIsApiConfigured(true);
    alert('API 설정이 완료되었습니다.');
  };

  // 롱 진입
  const handleLongEntry = async () => {
    if (!isApiConfigured) {
      alert('먼저 API를 설정해주세요.');
      return;
    }

    if (!highChannelEntryPoints.longEntry) {
      alert('진입점이 계산되지 않았습니다.');
      return;
    }

    setIsTrading(true);
    try {
      const qty = parseFloat(quantity);
      const entryPrice = highChannelEntryPoints.longEntry;
      const stopLoss = useStopLoss
        ? entryPrice * (1 - parseFloat(stopLossOffset) / 100)
        : undefined;

      console.log(`롱 진입 시도: 수량=${qty}, 진입가=${entryPrice}, 스탑로스=${stopLoss}`);

      const result = await BinanceFuturesAPI.enterLongPosition(symbol, qty, stopLoss);

      alert(`롱 포지션 진입 성공!\n진입가: $${entryPrice.toFixed(2)}`);
      console.log('롱 진입 결과:', result);
    } catch (error: any) {
      alert(`롱 진입 실패: ${error.message}`);
      console.error('롱 진입 에러:', error);
    } finally {
      setIsTrading(false);
    }
  };

  // 숏 진입
  const handleShortEntry = async () => {
    if (!isApiConfigured) {
      alert('먼저 API를 설정해주세요.');
      return;
    }

    if (!highChannelEntryPoints.shortEntry) {
      alert('진입점이 계산되지 않았습니다.');
      return;
    }

    setIsTrading(true);
    try {
      const qty = parseFloat(quantity);
      const entryPrice = highChannelEntryPoints.shortEntry;
      const stopLoss = useStopLoss
        ? entryPrice * (1 + parseFloat(stopLossOffset) / 100)
        : undefined;

      console.log(`숏 진입 시도: 수량=${qty}, 진입가=${entryPrice}, 스탑로스=${stopLoss}`);

      const result = await BinanceFuturesAPI.enterShortPosition(symbol, qty, stopLoss);

      alert(`숏 포지션 진입 성공!\n진입가: $${entryPrice.toFixed(2)}`);
      console.log('숏 진입 결과:', result);
    } catch (error: any) {
      alert(`숏 진입 실패: ${error.message}`);
      console.error('숏 진입 에러:', error);
    } finally {
      setIsTrading(false);
    }
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg space-y-4">
      <h2 className="text-xl font-semibold mb-4">거래 패널</h2>

      {/* API 설정 */}
      {!isApiConfigured ? (
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">API Key</label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              placeholder="바이낸스 API Key 입력"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">API Secret</label>
            <input
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              placeholder="바이낸스 API Secret 입력"
            />
          </div>
          <button
            onClick={handleConfigureApi}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            API 설정
          </button>
          <p className="text-xs text-gray-500">
            ⚠️ 주의: API Key는 선물 거래 권한이 있어야 하며, IP 화이트리스트 설정을 권장합니다.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-sm text-green-400">✓ API 설정 완료</div>

          {/* 거래 설정 */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">수량 (ETH)</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              step="0.001"
              min="0.001"
              className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">레버리지 (배수)</label>
            <input
              type="number"
              value={leverage}
              onChange={(e) => setLeverage(e.target.value)}
              step="1"
              min="1"
              max="125"
              className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="useStopLoss"
              checked={useStopLoss}
              onChange={(e) => setUseStopLoss(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="useStopLoss" className="text-sm text-gray-300">
              스탑로스 사용
            </label>
          </div>

          {useStopLoss && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                스탑로스 오프셋 (%)
              </label>
              <input
                type="number"
                value={stopLossOffset}
                onChange={(e) => setStopLossOffset(e.target.value)}
                step="0.1"
                min="0.1"
                className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                진입가 대비 {stopLossOffset}% 떨어진 지점에 스탑로스 설정
              </p>
            </div>
          )}

          {/* 자동 거래 토글 */}
          <div className="border border-gray-600 rounded p-3 bg-gray-750">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold">자동 거래</label>
              <button
                onClick={() => setIsAutoTradingEnabled(!isAutoTradingEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isAutoTradingEnabled ? 'bg-green-600' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isAutoTradingEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <p className="text-xs text-gray-400">
              {isAutoTradingEnabled
                ? '✓ 1시간마다 자동으로 롱/숏 진입 주문을 갱신합니다'
                : '수동으로 거래를 실행할 수 있습니다'}
            </p>
          </div>

          {/* 진입점 정보 */}
          {highChannelEntryPoints.longEntry && highChannelEntryPoints.shortEntry && (
            <div className="border border-gray-600 rounded p-3 space-y-2">
              <div className="text-sm">
                <span className="text-gray-400">롱 진입가:</span>{' '}
                <span className="text-green-400 font-semibold">
                  ${highChannelEntryPoints.longEntry.toFixed(2)}
                </span>
                {useStopLoss && (
                  <span className="text-xs text-gray-500 ml-2">
                    (SL: ${(highChannelEntryPoints.longEntry * (1 - parseFloat(stopLossOffset) / 100)).toFixed(2)})
                  </span>
                )}
              </div>
              <div className="text-sm">
                <span className="text-gray-400">숏 진입가:</span>{' '}
                <span className="text-red-400 font-semibold">
                  ${highChannelEntryPoints.shortEntry.toFixed(2)}
                </span>
                {useStopLoss && (
                  <span className="text-xs text-gray-500 ml-2">
                    (SL: ${(highChannelEntryPoints.shortEntry * (1 + parseFloat(stopLossOffset) / 100)).toFixed(2)})
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 거래 버튼 */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleLongEntry}
              disabled={isTrading || !highChannelEntryPoints.longEntry}
              className="px-4 py-3 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-semibold"
            >
              {isTrading ? '진행중...' : '롱 진입 ▲'}
            </button>
            <button
              onClick={handleShortEntry}
              disabled={isTrading || !highChannelEntryPoints.shortEntry}
              className="px-4 py-3 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-semibold"
            >
              {isTrading ? '진행중...' : '숏 진입 ▼'}
            </button>
          </div>

          <button
            onClick={() => setIsApiConfigured(false)}
            className="w-full px-4 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors text-sm"
          >
            API 재설정
          </button>
        </div>
      )}
    </div>
  );
};
