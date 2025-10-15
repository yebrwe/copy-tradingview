import CryptoJS from 'crypto-js';

// 바이낸스 선물 API 설정
const FUTURES_API_BASE_URL = 'https://fapi.binance.com';

interface BinanceFuturesConfig {
  apiKey: string;
  apiSecret: string;
}

interface SymbolInfo {
  symbol: string;
  quantityPrecision: number;
  pricePrecision: number;
  stepSize: string;
  minQty: string;
  maxQty: string;
}

// 심볼 정보 캐시
const symbolInfoCache: Map<string, SymbolInfo> = new Map();

// API Key 설정 (환경 변수 또는 설정에서 가져오기)
let config: BinanceFuturesConfig = {
  apiKey: '',
  apiSecret: '',
};

export const setApiCredentials = (apiKey: string, apiSecret: string) => {
  config.apiKey = apiKey;
  config.apiSecret = apiSecret;
};

// HMAC SHA256 서명 생성
const createSignature = (queryString: string): string => {
  return CryptoJS.HmacSHA256(queryString, config.apiSecret).toString();
};

// 타임스탬프 생성
const getTimestamp = (): number => {
  return Date.now();
};

// API 요청 헤더
const getHeaders = () => ({
  'X-MBX-APIKEY': config.apiKey,
  'Content-Type': 'application/json',
});

/**
 * 심볼 정보 조회 (exchangeInfo)
 */
export const getSymbolInfo = async (symbol: string): Promise<SymbolInfo> => {
  // 캐시에서 먼저 확인
  if (symbolInfoCache.has(symbol)) {
    return symbolInfoCache.get(symbol)!;
  }

  try {
    const response = await fetch(`${FUTURES_API_BASE_URL}/fapi/v1/exchangeInfo`);
    if (!response.ok) {
      throw new Error('Failed to fetch exchange info');
    }

    const data = await response.json();
    const symbolData = data.symbols.find((s: any) => s.symbol === symbol);

    if (!symbolData) {
      throw new Error(`Symbol ${symbol} not found`);
    }

    // LOT_SIZE 필터에서 stepSize, minQty, maxQty 추출
    const lotSizeFilter = symbolData.filters.find((f: any) => f.filterType === 'LOT_SIZE');

    const info: SymbolInfo = {
      symbol,
      quantityPrecision: symbolData.quantityPrecision,
      pricePrecision: symbolData.pricePrecision,
      stepSize: lotSizeFilter?.stepSize || '1',
      minQty: lotSizeFilter?.minQty || '0',
      maxQty: lotSizeFilter?.maxQty || '10000000',
    };

    // 캐시에 저장
    symbolInfoCache.set(symbol, info);
    return info;
  } catch (error) {
    console.error('Get symbol info error:', error);
    throw error;
  }
};

/**
 * 수량을 심볼의 stepSize에 맞춰 조정
 */
export const adjustQuantityPrecision = (quantity: number, stepSize: string): number => {
  const stepSizeNum = parseFloat(stepSize);
  const precision = stepSize.indexOf('1') - 1;

  // stepSize에 맞춰 반올림
  const adjusted = Math.floor(quantity / stepSizeNum) * stepSizeNum;

  // 정밀도에 맞춰 반올림
  return parseFloat(adjusted.toFixed(Math.abs(precision)));
};

/**
 * 가격을 심볼의 pricePrecision에 맞춰 조정
 */
export const adjustPricePrecision = (price: number, pricePrecision: number): number => {
  return parseFloat(price.toFixed(pricePrecision));
};

interface OrderParams {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP_MARKET' | 'TAKE_PROFIT_MARKET';
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
  reduceOnly?: boolean;
}

/**
 * 선물 주문 생성
 */
const createOrder = async (params: OrderParams) => {
  if (!config.apiKey || !config.apiSecret) {
    throw new Error('API credentials not set. Please call setApiCredentials first.');
  }

  // 심볼 정보 조회 및 정밀도 조정
  const symbolInfo = await getSymbolInfo(params.symbol);

  // 수량 조정
  let adjustedQuantity = adjustQuantityPrecision(params.quantity, symbolInfo.stepSize);

  // 최소/최대 수량 검증
  const minQty = parseFloat(symbolInfo.minQty);
  const maxQty = parseFloat(symbolInfo.maxQty);

  if (adjustedQuantity < minQty) {
    throw new Error(`수량이 최소값(${minQty})보다 작습니다. 현재: ${adjustedQuantity}`);
  }
  if (adjustedQuantity > maxQty) {
    throw new Error(`수량이 최대값(${maxQty})을 초과합니다. 현재: ${adjustedQuantity}`);
  }

  const timestamp = getTimestamp();

  // 쿼리 파라미터 구성
  const queryParams: any = {
    symbol: params.symbol,
    side: params.side,
    type: params.type,
    quantity: adjustedQuantity,
    timestamp,
  };

  if (params.price) {
    queryParams.price = adjustPricePrecision(params.price, symbolInfo.pricePrecision);
  }
  if (params.stopPrice) {
    queryParams.stopPrice = adjustPricePrecision(params.stopPrice, symbolInfo.pricePrecision);
  }
  if (params.timeInForce) queryParams.timeInForce = params.timeInForce;

  // STOP_MARKET과 TAKE_PROFIT_MARKET은 reduceOnly=true 필수
  if (params.type === 'STOP_MARKET' || params.type === 'TAKE_PROFIT_MARKET') {
    queryParams.reduceOnly = params.reduceOnly !== undefined ? params.reduceOnly : true;
  } else if (params.reduceOnly !== undefined) {
    queryParams.reduceOnly = params.reduceOnly;
  }

  // 쿼리 스트링 생성
  const queryString = Object.keys(queryParams)
    .map(key => `${key}=${queryParams[key]}`)
    .join('&');

  // 서명 추가
  const signature = createSignature(queryString);
  const signedQueryString = `${queryString}&signature=${signature}`;

  try {
    const response = await fetch(`${FUTURES_API_BASE_URL}/fapi/v1/order?${signedQueryString}`, {
      method: 'POST',
      headers: getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Binance API Error: ${error.msg || response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Create order error:', error);
    throw error;
  }
};

/**
 * 롱 포지션 진입 (시장가)
 * @param symbol 심볼 (예: 'ETHUSDT')
 * @param quantity 수량
 * @param stopLossPrice 스탑로스 가격 (옵션)
 */
export const enterLongPosition = async (
  symbol: string,
  quantity: number,
  stopLossPrice?: number
) => {
  console.log(`롱 진입: ${symbol}, 수량: ${quantity}, 스탑로스: ${stopLossPrice || 'N/A'}`);

  // 1. 시장가 매수 주문
  const buyOrder = await createOrder({
    symbol,
    side: 'BUY',
    type: 'MARKET',
    quantity,
  });

  console.log('롱 포지션 진입 완료:', buyOrder);

  // 2. 스탑로스 설정 (옵션)
  if (stopLossPrice) {
    const stopLossOrder = await createOrder({
      symbol,
      side: 'SELL',
      type: 'STOP_MARKET',
      quantity,
      stopPrice: stopLossPrice,
    });

    console.log('스탑로스 설정 완료:', stopLossOrder);
    return { buyOrder, stopLossOrder };
  }

  return { buyOrder };
};

/**
 * 숏 포지션 진입 (시장가)
 * @param symbol 심볼 (예: 'ETHUSDT')
 * @param quantity 수량
 * @param stopLossPrice 스탑로스 가격 (옵션)
 */
export const enterShortPosition = async (
  symbol: string,
  quantity: number,
  stopLossPrice?: number
) => {
  console.log(`숏 진입: ${symbol}, 수량: ${quantity}, 스탑로스: ${stopLossPrice || 'N/A'}`);

  // 1. 시장가 매도 주문
  const sellOrder = await createOrder({
    symbol,
    side: 'SELL',
    type: 'MARKET',
    quantity,
  });

  console.log('숏 포지션 진입 완료:', sellOrder);

  // 2. 스탑로스 설정 (옵션)
  if (stopLossPrice) {
    const stopLossOrder = await createOrder({
      symbol,
      side: 'BUY',
      type: 'STOP_MARKET',
      quantity,
      stopPrice: stopLossPrice,
    });

    console.log('스탑로스 설정 완료:', stopLossOrder);
    return { sellOrder, stopLossOrder };
  }

  return { sellOrder };
};

/**
 * 포지션 청산 (시장가)
 * @param symbol 심볼
 * @param side 'BUY' (숏 청산) 또는 'SELL' (롱 청산)
 * @param quantity 수량
 */
export const closePosition = async (
  symbol: string,
  side: 'BUY' | 'SELL',
  quantity: number
) => {
  console.log(`포지션 청산: ${symbol}, ${side}, 수량: ${quantity}`);

  const closeOrder = await createOrder({
    symbol,
    side,
    type: 'MARKET',
    quantity,
  });

  console.log('포지션 청산 완료:', closeOrder);
  return closeOrder;
};

/**
 * 현재 포지션 조회
 */
export const getPositionInfo = async (symbol: string) => {
  if (!config.apiKey || !config.apiSecret) {
    throw new Error('API credentials not set.');
  }

  const timestamp = getTimestamp();
  const queryString = `symbol=${symbol}&timestamp=${timestamp}`;
  const signature = createSignature(queryString);

  try {
    const response = await fetch(
      `${FUTURES_API_BASE_URL}/fapi/v2/positionRisk?${queryString}&signature=${signature}`,
      {
        method: 'GET',
        headers: getHeaders(),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Binance API Error: ${error.msg || response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Get position error:', error);
    throw error;
  }
};

/**
 * 계좌 잔고 조회
 */
export const getAccountBalance = async () => {
  if (!config.apiKey || !config.apiSecret) {
    throw new Error('API credentials not set.');
  }

  const timestamp = getTimestamp();
  const queryString = `timestamp=${timestamp}`;
  const signature = createSignature(queryString);

  try {
    const response = await fetch(
      `${FUTURES_API_BASE_URL}/fapi/v2/balance?${queryString}&signature=${signature}`,
      {
        method: 'GET',
        headers: getHeaders(),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Binance API Error: ${error.msg || response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Get balance error:', error);
    throw error;
  }
};

/**
 * 레버리지 조회
 */
export const getLeverage = async (symbol: string) => {
  if (!config.apiKey || !config.apiSecret) {
    throw new Error('API credentials not set.');
  }

  const timestamp = getTimestamp();
  const queryString = `symbol=${symbol}&timestamp=${timestamp}`;
  const signature = createSignature(queryString);

  try {
    const response = await fetch(
      `${FUTURES_API_BASE_URL}/fapi/v2/positionRisk?${queryString}&signature=${signature}`,
      {
        method: 'GET',
        headers: getHeaders(),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Binance API Error: ${error.msg || response.statusText}`);
    }

    const positions = await response.json();
    // 해당 심볼의 포지션 정보 찾기
    const position = positions.find((p: any) => p.symbol === symbol);

    if (position) {
      return parseInt(position.leverage);
    }

    // 포지션이 없으면 기본값 1 반환
    return 1;
  } catch (error) {
    console.error('Get leverage error:', error);
    throw error;
  }
};

/**
 * 레버리지 설정
 */
export const setLeverage = async (symbol: string, leverage: number) => {
  if (!config.apiKey || !config.apiSecret) {
    throw new Error('API credentials not set.');
  }

  const timestamp = getTimestamp();
  const queryString = `symbol=${symbol}&leverage=${leverage}&timestamp=${timestamp}`;
  const signature = createSignature(queryString);

  try {
    const response = await fetch(
      `${FUTURES_API_BASE_URL}/fapi/v1/leverage?${queryString}&signature=${signature}`,
      {
        method: 'POST',
        headers: getHeaders(),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Binance API Error: ${error.msg || response.statusText}`);
    }

    const result = await response.json();
    console.log(`레버리지 ${leverage}배 설정 완료:`, result);
    return result;
  } catch (error) {
    console.error('Set leverage error:', error);
    throw error;
  }
};

/**
 * 미체결 주문 조회
 */
export const getOpenOrders = async (symbol?: string) => {
  if (!config.apiKey || !config.apiSecret) {
    throw new Error('API credentials not set.');
  }

  const timestamp = getTimestamp();
  const queryString = symbol
    ? `symbol=${symbol}&timestamp=${timestamp}`
    : `timestamp=${timestamp}`;
  const signature = createSignature(queryString);

  try {
    const response = await fetch(
      `${FUTURES_API_BASE_URL}/fapi/v1/openOrders?${queryString}&signature=${signature}`,
      {
        method: 'GET',
        headers: getHeaders(),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Binance API Error: ${error.msg || response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Get open orders error:', error);
    throw error;
  }
};

/**
 * 주문 취소
 */
export const cancelOrder = async (symbol: string, orderId: number) => {
  if (!config.apiKey || !config.apiSecret) {
    throw new Error('API credentials not set.');
  }

  const timestamp = getTimestamp();
  const queryString = `symbol=${symbol}&orderId=${orderId}&timestamp=${timestamp}`;
  const signature = createSignature(queryString);

  try {
    const response = await fetch(
      `${FUTURES_API_BASE_URL}/fapi/v1/order?${queryString}&signature=${signature}`,
      {
        method: 'DELETE',
        headers: getHeaders(),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Binance API Error: ${error.msg || response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Cancel order error:', error);
    throw error;
  }
};

/**
 * 모든 미체결 주문 취소
 */
export const cancelAllOpenOrders = async (symbol: string) => {
  if (!config.apiKey || !config.apiSecret) {
    throw new Error('API credentials not set.');
  }

  const timestamp = getTimestamp();
  const queryString = `symbol=${symbol}&timestamp=${timestamp}`;
  const signature = createSignature(queryString);

  try {
    const response = await fetch(
      `${FUTURES_API_BASE_URL}/fapi/v1/allOpenOrders?${queryString}&signature=${signature}`,
      {
        method: 'DELETE',
        headers: getHeaders(),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Binance API Error: ${error.msg || response.statusText}`);
    }

    const result = await response.json();
    console.log('모든 미체결 주문 취소 완료:', result);
    return result;
  } catch (error) {
    console.error('Cancel all orders error:', error);
    throw error;
  }
};

/**
 * 리밋 주문 생성 (진입점 주문)
 */
export const createLimitOrder = async (
  symbol: string,
  side: 'BUY' | 'SELL',
  quantity: number,
  price: number
) => {
  return await createOrder({
    symbol,
    side,
    type: 'LIMIT',
    quantity,
    price,
    timeInForce: 'GTC',
  });
};

export const BinanceFuturesAPI = {
  setApiCredentials,
  getLeverage,
  setLeverage,
  enterLongPosition,
  enterShortPosition,
  closePosition,
  getPositionInfo,
  getAccountBalance,
  getOpenOrders,
  cancelOrder,
  cancelAllOpenOrders,
  createLimitOrder,
  createOrder,
  getSymbolInfo,
  adjustQuantityPrecision,
  adjustPricePrecision,
};
