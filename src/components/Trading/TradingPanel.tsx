import { useState, useEffect } from 'react';
import { BinanceFuturesAPI } from '../../services/binanceFuturesAPI';
import { useChartStore } from '../../store/chartStore';
import { useAutoTrading } from '../../hooks/useAutoTrading';
import { useToastStore } from '../../store/toastStore';
import { useOrderHistoryStore } from '../../store/orderHistoryStore';

// localStorage 키
const STORAGE_KEYS = {
  API_KEY: 'trading_api_key',
  API_SECRET: 'trading_api_secret',
  IS_API_CONFIGURED: 'trading_is_api_configured',
  QUANTITY: 'trading_quantity',
  LEVERAGE: 'trading_leverage',
  USE_STOP_LOSS: 'trading_use_stop_loss',
  STOP_LOSS_OFFSET: 'trading_stop_loss_offset',
  USE_TAKE_PROFIT: 'trading_use_take_profit',
  TAKE_PROFIT_OFFSET: 'trading_take_profit_offset',
  IS_AUTO_TRADING: 'trading_is_auto_trading',
  USE_PERCENTAGE: 'trading_use_percentage',
  ACCOUNT_PERCENTAGE: 'trading_account_percentage',
};

// API 호출 간 딜레이 (밀리초)
const API_CALL_DELAY = 300; // 300ms
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const TradingPanel = () => {
  const { symbol, highChannelEntryPoints } = useChartStore();
  const { showSuccess, showError, showWarning } = useToastStore();
  const { addOrder } = useOrderHistoryStore();

  // localStorage에서 값 불러오기
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(STORAGE_KEYS.API_KEY) || '');
  const [apiSecret, setApiSecret] = useState(() => localStorage.getItem(STORAGE_KEYS.API_SECRET) || '');
  const [isApiConfigured, setIsApiConfigured] = useState(() =>
    localStorage.getItem(STORAGE_KEYS.IS_API_CONFIGURED) === 'true'
  );
  const [quantity, setQuantity] = useState(() => localStorage.getItem(STORAGE_KEYS.QUANTITY) || '0.01');
  const [leverage, setLeverage] = useState(() => localStorage.getItem(STORAGE_KEYS.LEVERAGE) || '10');
  const [useStopLoss, setUseStopLoss] = useState(() =>
    localStorage.getItem(STORAGE_KEYS.USE_STOP_LOSS) !== 'false'
  );
  const [stopLossOffset, setStopLossOffset] = useState(() =>
    localStorage.getItem(STORAGE_KEYS.STOP_LOSS_OFFSET) || '5'
  );
  const [useTakeProfit, setUseTakeProfit] = useState(() =>
    localStorage.getItem(STORAGE_KEYS.USE_TAKE_PROFIT) === 'true'
  );
  const [takeProfitOffset, setTakeProfitOffset] = useState(() =>
    localStorage.getItem(STORAGE_KEYS.TAKE_PROFIT_OFFSET) || '10'
  );
  const [isAutoTradingEnabled, setIsAutoTradingEnabled] = useState(() =>
    localStorage.getItem(STORAGE_KEYS.IS_AUTO_TRADING) === 'true'
  );
  const [isTrading, setIsTrading] = useState(false);

  // 잔고 관련
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [usePercentage, setUsePercentage] = useState(() =>
    localStorage.getItem(STORAGE_KEYS.USE_PERCENTAGE) === 'true'
  );
  const [accountPercentage, setAccountPercentage] = useState(() =>
    localStorage.getItem(STORAGE_KEYS.ACCOUNT_PERCENTAGE) || '10'
  );

  // 레버리지 관련
  const [currentBinanceLeverage, setCurrentBinanceLeverage] = useState<number | null>(null);
  const [isLoadingLeverage, setIsLoadingLeverage] = useState(false);

  // localStorage에 값 저장
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.API_KEY, apiKey);
  }, [apiKey]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.API_SECRET, apiSecret);
  }, [apiSecret]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.IS_API_CONFIGURED, String(isApiConfigured));
  }, [isApiConfigured]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.QUANTITY, quantity);
  }, [quantity]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LEVERAGE, leverage);
  }, [leverage]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.USE_STOP_LOSS, String(useStopLoss));
  }, [useStopLoss]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.STOP_LOSS_OFFSET, stopLossOffset);
  }, [stopLossOffset]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.USE_TAKE_PROFIT, String(useTakeProfit));
  }, [useTakeProfit]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TAKE_PROFIT_OFFSET, takeProfitOffset);
  }, [takeProfitOffset]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.IS_AUTO_TRADING, String(isAutoTradingEnabled));
  }, [isAutoTradingEnabled]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.USE_PERCENTAGE, String(usePercentage));
  }, [usePercentage]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ACCOUNT_PERCENTAGE, accountPercentage);
  }, [accountPercentage]);

  // 자동 거래 Hook
  const { executeManually, calculateTradingMetrics } = useAutoTrading({
    enabled: isAutoTradingEnabled && isApiConfigured,
    leverage: parseInt(leverage),
    quantity: parseFloat(quantity),
    stopLossPercent: parseFloat(stopLossOffset),
    takeProfitPercent: parseFloat(takeProfitOffset),
    useStopLoss: useStopLoss,
    useTakeProfit: useTakeProfit,
    usePercentage: usePercentage,
    accountPercentage: parseFloat(accountPercentage),
    balance: balance || undefined,
  });

  // 자동 거래 토글 ON 시 즉시 실행
  useEffect(() => {
    if (isAutoTradingEnabled && isApiConfigured && highChannelEntryPoints.longEntry && highChannelEntryPoints.shortEntry) {
      console.log('자동 거래 토글 ON - 즉시 주문 실행');
      executeManually();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAutoTradingEnabled]); // isAutoTradingEnabled가 변경될 때만 실행

  // 잔고 조회
  const fetchBalance = async () => {
    setIsLoadingBalance(true);
    try {
      const balances = await BinanceFuturesAPI.getAccountBalance();
      // USDT 잔고 찾기
      const usdtBalance = balances.find((b: any) => b.asset === 'USDT');
      if (usdtBalance) {
        setBalance(parseFloat(usdtBalance.availableBalance));
      }
    } catch (error: any) {
      console.error('잔고 조회 에러:', error);
      showError(`잔고 조회 실패: ${error.message}`);
    } finally {
      setIsLoadingBalance(false);
    }
  };

  // 레버리지 조회
  const fetchLeverage = async () => {
    setIsLoadingLeverage(true);
    try {
      const currentLeverage = await BinanceFuturesAPI.getLeverage(symbol);
      setCurrentBinanceLeverage(currentLeverage);
      // 조회한 레버리지로 입력값도 업데이트
      setLeverage(String(currentLeverage));
    } catch (error: any) {
      console.error('레버리지 조회 에러:', error);
      console.log('레버리지 조회 실패, 기본값 사용');
    } finally {
      setIsLoadingLeverage(false);
    }
  };

  // 레버리지 설정
  const handleUpdateLeverage = async () => {
    const newLeverage = parseInt(leverage);
    if (isNaN(newLeverage) || newLeverage < 1 || newLeverage > 125) {
      showWarning('레버리지는 1~125 사이의 값이어야 합니다.');
      return;
    }

    setIsLoadingLeverage(true);
    try {
      await BinanceFuturesAPI.setLeverage(symbol, newLeverage);
      setCurrentBinanceLeverage(newLeverage);
      showSuccess(`레버리지가 ${newLeverage}배로 설정되었습니다.`);
    } catch (error: any) {
      showError(`레버리지 설정 실패: ${error.message}`);
      console.error('레버리지 설정 에러:', error);
    } finally {
      setIsLoadingLeverage(false);
    }
  };

  // 비율로 수량 계산
  const calculateQuantityFromPercentage = (currentPrice: number) => {
    if (!balance || !usePercentage) return parseFloat(quantity);

    const percentage = parseFloat(accountPercentage) / 100;
    const lev = parseInt(leverage);

    // 사용 가능한 증거금 = 잔고 × 비율
    const availableMargin = balance * percentage;

    // 주문 수량 = (증거금 × 레버리지) / 현재가
    const calculatedQty = (availableMargin * lev) / currentPrice;

    return calculatedQty;
  };

  // API 설정이 저장되어 있으면 자동으로 설정
  useEffect(() => {
    if (isApiConfigured && apiKey && apiSecret) {
      BinanceFuturesAPI.setApiCredentials(apiKey, apiSecret);
      fetchBalance();
      fetchLeverage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 초기 마운트 시에만 실행

  // API 자격 증명 설정
  const handleConfigureApi = async () => {
    if (!apiKey || !apiSecret) {
      showWarning('API Key와 Secret을 입력해주세요.');
      return;
    }

    BinanceFuturesAPI.setApiCredentials(apiKey, apiSecret);
    setIsApiConfigured(true);

    // 잔고 및 레버리지 조회
    await Promise.all([fetchBalance(), fetchLeverage()]);

    showSuccess('API 설정이 완료되었습니다.');
  };

  // 롱 진입
  const handleLongEntry = async () => {
    if (!isApiConfigured) {
      showWarning('먼저 API를 설정해주세요.');
      return;
    }

    if (!highChannelEntryPoints.longEntry) {
      showWarning('진입점이 계산되지 않았습니다.');
      return;
    }

    setIsTrading(true);
    try {
      const entryPrice = highChannelEntryPoints.longEntry;
      const qty = calculateQuantityFromPercentage(entryPrice);
      const stopLoss = useStopLoss
        ? entryPrice * (1 - parseFloat(stopLossOffset) / 100)
        : undefined;
      const takeProfit = useTakeProfit
        ? entryPrice * (1 + parseFloat(takeProfitOffset) / 100)
        : undefined;

      // 진입 주문과 스탑로스, 테이크프로핏을 연결할 pairId 생성
      const pairId = `long_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      console.log(`롱 리밋 주문 생성 시도: 수량=${qty}, 진입가=${entryPrice}, 스탑로스=${stopLoss}, 테이크프로핏=${takeProfit}`);

      // 롱 진입 리밋 주문 생성
      const limitOrder = await BinanceFuturesAPI.createLimitOrder(
        symbol,
        'BUY',
        qty,
        entryPrice
      );
      console.log('롱 리밋 주문 생성 완료:', limitOrder);

      // 주문 내역 저장
      addOrder({
        symbol,
        side: 'BUY',
        type: 'LIMIT',
        quantity: qty,
        price: entryPrice,
        status: 'pending',
        orderId: limitOrder.orderId,
        isAutoTrading: false,
        pairId,
      });

      // 스탑로스 주문 생성
      if (stopLoss) {
        try {
          await delay(API_CALL_DELAY); // API 호출 간 딜레이
          const stopLossOrder = await BinanceFuturesAPI.createOrder({
            symbol,
            side: 'SELL',
            type: 'STOP_MARKET',
            quantity: qty,
            stopPrice: stopLoss,
          });
          console.log('롱 스탑로스 설정 완료:', stopLossOrder);

          // 스탑로스 주문 내역 저장
          addOrder({
            symbol,
            side: 'SELL',
            type: 'STOP_MARKET',
            quantity: qty,
            stopPrice: stopLoss,
            status: 'pending',
            orderId: stopLossOrder.orderId,
            isAutoTrading: false,
            pairId,
          });
        } catch (error: any) {
          // -2021: Order would immediately trigger 에러는 경고만 표시
          if (error.message?.includes('-2021') || error.message?.includes('immediately trigger')) {
            console.warn('스탑로스 주문 스킵 (가격 조건 불일치):', error.message);
            showWarning('스탑로스 주문이 스킵되었습니다 (가격 조건 불일치)');
          } else {
            throw error; // 다른 에러는 상위로 전파
          }
        }
      }

      // 테이크프로핏 주문 생성
      if (takeProfit) {
        try {
          await delay(API_CALL_DELAY); // API 호출 간 딜레이
          const takeProfitOrder = await BinanceFuturesAPI.createOrder({
            symbol,
            side: 'SELL',
            type: 'TAKE_PROFIT_MARKET',
            quantity: qty,
            stopPrice: takeProfit,
          });
          console.log('롱 테이크프로핏 설정 완료:', takeProfitOrder);

          // 테이크프로핏 주문 내역 저장
          addOrder({
            symbol,
            side: 'SELL',
            type: 'TAKE_PROFIT_MARKET',
            quantity: qty,
            takeProfitPrice: takeProfit,
            status: 'pending',
            orderId: takeProfitOrder.orderId,
            isAutoTrading: false,
            pairId,
          });
        } catch (error: any) {
          // -2021: Order would immediately trigger 에러는 경고만 표시
          if (error.message?.includes('-2021') || error.message?.includes('immediately trigger')) {
            console.warn('롱 테이크프로핏 주문 스킵 (가격 조건 불일치):', {
              진입가: entryPrice,
              TP가격: takeProfit,
              현재시장상황: '진입가보다 이미 높음 (즉시 실행될 상태)',
              에러: error.message
            });
            showWarning('롱 테이크프로핏 주문이 스킵되었습니다 (현재가가 이미 TP 조건 도달)');
          } else {
            throw error; // 다른 에러는 상위로 전파
          }
        }
      }

      // 진입 후 잔고 갱신
      await fetchBalance();

      showSuccess(`롱 리밋 주문 생성 완료! 진입가: $${entryPrice.toFixed(2)}, 수량: ${qty.toFixed(4)} ETH`, '롱 주문 생성');
    } catch (error: any) {
      showError(`롱 주문 생성 실패: ${error.message}`);
      console.error('롱 주문 에러:', error);
    } finally {
      setIsTrading(false);
    }
  };

  // 숏 진입
  const handleShortEntry = async () => {
    if (!isApiConfigured) {
      showWarning('먼저 API를 설정해주세요.');
      return;
    }

    if (!highChannelEntryPoints.shortEntry) {
      showWarning('진입점이 계산되지 않았습니다.');
      return;
    }

    setIsTrading(true);
    try {
      const entryPrice = highChannelEntryPoints.shortEntry;
      const qty = calculateQuantityFromPercentage(entryPrice);
      const stopLoss = useStopLoss
        ? entryPrice * (1 + parseFloat(stopLossOffset) / 100)
        : undefined;
      const takeProfit = useTakeProfit
        ? entryPrice * (1 - parseFloat(takeProfitOffset) / 100)
        : undefined;

      // 진입 주문과 스탑로스, 테이크프로핏을 연결할 pairId 생성
      const pairId = `short_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      console.log(`숏 리밋 주문 생성 시도: 수량=${qty}, 진입가=${entryPrice}, 스탑로스=${stopLoss}, 테이크프로핏=${takeProfit}`);

      // 숏 진입 리밋 주문 생성
      const limitOrder = await BinanceFuturesAPI.createLimitOrder(
        symbol,
        'SELL',
        qty,
        entryPrice
      );
      console.log('숏 리밋 주문 생성 완료:', limitOrder);

      // 주문 내역 저장
      addOrder({
        symbol,
        side: 'SELL',
        type: 'LIMIT',
        quantity: qty,
        price: entryPrice,
        status: 'pending',
        orderId: limitOrder.orderId,
        isAutoTrading: false,
        pairId,
      });

      // 스탑로스 주문 생성
      if (stopLoss) {
        try {
          await delay(API_CALL_DELAY); // API 호출 간 딜레이
          const stopLossOrder = await BinanceFuturesAPI.createOrder({
            symbol,
            side: 'BUY',
            type: 'STOP_MARKET',
            quantity: qty,
            stopPrice: stopLoss,
          });
          console.log('숏 스탑로스 설정 완료:', stopLossOrder);

          // 스탑로스 주문 내역 저장
          addOrder({
            symbol,
            side: 'BUY',
            type: 'STOP_MARKET',
            quantity: qty,
            stopPrice: stopLoss,
            status: 'pending',
            orderId: stopLossOrder.orderId,
            isAutoTrading: false,
            pairId,
          });
        } catch (error: any) {
          // -2021: Order would immediately trigger 에러는 경고만 표시
          if (error.message?.includes('-2021') || error.message?.includes('immediately trigger')) {
            console.warn('스탑로스 주문 스킵 (가격 조건 불일치):', error.message);
            showWarning('스탑로스 주문이 스킵되었습니다 (가격 조건 불일치)');
          } else {
            throw error; // 다른 에러는 상위로 전파
          }
        }
      }

      // 테이크프로핏 주문 생성
      if (takeProfit) {
        try {
          await delay(API_CALL_DELAY); // API 호출 간 딜레이
          const takeProfitOrder = await BinanceFuturesAPI.createOrder({
            symbol,
            side: 'BUY',
            type: 'TAKE_PROFIT_MARKET',
            quantity: qty,
            stopPrice: takeProfit,
          });
          console.log('숏 테이크프로핏 설정 완료:', takeProfitOrder);

          // 테이크프로핏 주문 내역 저장
          addOrder({
            symbol,
            side: 'BUY',
            type: 'TAKE_PROFIT_MARKET',
            quantity: qty,
            takeProfitPrice: takeProfit,
            status: 'pending',
            orderId: takeProfitOrder.orderId,
            isAutoTrading: false,
            pairId,
          });
        } catch (error: any) {
          // -2021: Order would immediately trigger 에러는 경고만 표시
          if (error.message?.includes('-2021') || error.message?.includes('immediately trigger')) {
            console.warn('숏 테이크프로핏 주문 스킵 (가격 조건 불일치):', {
              진입가: entryPrice,
              TP가격: takeProfit,
              현재시장상황: '진입가보다 이미 낮음 (즉시 실행될 상태)',
              에러: error.message
            });
            showWarning('숏 테이크프로핏 주문이 스킵되었습니다 (현재가가 이미 TP 조건 도달)');
          } else {
            throw error; // 다른 에러는 상위로 전파
          }
        }
      }

      // 진입 후 잔고 갱신
      await fetchBalance();

      showSuccess(`숏 리밋 주문 생성 완료! 진입가: $${entryPrice.toFixed(2)}, 수량: ${qty.toFixed(4)} ETH`, '숏 주문 생성');
    } catch (error: any) {
      showError(`숏 주문 생성 실패: ${error.message}`);
      console.error('숏 주문 에러:', error);
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
          <div className="flex items-center justify-between">
            <div className="text-sm text-green-400">✓ API 설정 완료</div>
            <button
              onClick={fetchBalance}
              disabled={isLoadingBalance}
              className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              {isLoadingBalance ? '조회 중...' : '잔고 갱신'}
            </button>
          </div>

          {/* 잔고 표시 */}
          {balance !== null && (
            <div className="border border-gray-600 rounded p-3 bg-gray-750">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">사용 가능 잔고</span>
                <span className="text-lg font-semibold text-yellow-400">
                  ${balance.toFixed(2)} USDT
                </span>
              </div>
            </div>
          )}

          {/* 수량 입력 방식 선택 */}
          <div className="border border-gray-600 rounded p-3">
            <div className="flex items-center gap-4 mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={!usePercentage}
                  onChange={() => setUsePercentage(false)}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-300">직접 입력</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={usePercentage}
                  onChange={() => setUsePercentage(true)}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-300">자산 비율</span>
              </label>
            </div>

            {!usePercentage ? (
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
            ) : (
              <div>
                <label className="block text-sm text-gray-400 mb-1">자산 비율 (%)</label>
                <input
                  type="number"
                  value={accountPercentage}
                  onChange={(e) => setAccountPercentage(e.target.value)}
                  step="1"
                  min="1"
                  max="100"
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  총 자산의 {accountPercentage}%를 사용하여 {leverage}배 레버리지로 거래
                </p>
                {balance && highChannelEntryPoints.longEntry && (
                  <p className="text-xs text-blue-400 mt-1">
                    예상 수량: ~{calculateQuantityFromPercentage(highChannelEntryPoints.longEntry).toFixed(4)} ETH
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm text-gray-400">레버리지 (배수)</label>
              {currentBinanceLeverage !== null && (
                <span className="text-xs text-blue-400">
                  현재: {currentBinanceLeverage}배
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                value={leverage}
                onChange={(e) => setLeverage(e.target.value)}
                step="1"
                min="1"
                max="125"
                className="flex-1 px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
              <button
                onClick={handleUpdateLeverage}
                disabled={isLoadingLeverage || currentBinanceLeverage === parseInt(leverage)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors text-sm"
              >
                {isLoadingLeverage ? '...' : '적용'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              1~125배 사이로 설정 가능. 변경 후 '적용' 버튼 클릭
            </p>
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

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="useTakeProfit"
              checked={useTakeProfit}
              onChange={(e) => setUseTakeProfit(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="useTakeProfit" className="text-sm text-gray-300">
              테이크프로핏 사용
            </label>
          </div>

          {useTakeProfit && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                테이크프로핏 오프셋 (%)
              </label>
              <input
                type="number"
                value={takeProfitOffset}
                onChange={(e) => setTakeProfitOffset(e.target.value)}
                step="0.1"
                min="0.1"
                className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                진입가 대비 {takeProfitOffset}% 상승한 지점에 테이크프로핏 설정
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
                {useTakeProfit && (
                  <span className="text-xs text-green-500 ml-2">
                    (TP: ${(highChannelEntryPoints.longEntry * (1 + parseFloat(takeProfitOffset) / 100)).toFixed(2)})
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
                {useTakeProfit && (
                  <span className="text-xs text-green-500 ml-2">
                    (TP: ${(highChannelEntryPoints.shortEntry * (1 - parseFloat(takeProfitOffset) / 100)).toFixed(2)})
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
              {isTrading ? '주문중...' : '롱 주문 ▲'}
            </button>
            <button
              onClick={handleShortEntry}
              disabled={isTrading || !highChannelEntryPoints.shortEntry}
              className="px-4 py-3 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-semibold"
            >
              {isTrading ? '주문중...' : '숏 주문 ▼'}
            </button>
          </div>

          <button
            onClick={() => {
              setIsApiConfigured(false);
              setBalance(null);
              // localStorage의 API 키만 초기화 (다른 설정은 유지)
              localStorage.removeItem(STORAGE_KEYS.API_KEY);
              localStorage.removeItem(STORAGE_KEYS.API_SECRET);
              localStorage.removeItem(STORAGE_KEYS.IS_API_CONFIGURED);
            }}
            className="w-full px-4 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors text-sm"
          >
            API 재설정
          </button>
        </div>
      )}
    </div>
  );
};
