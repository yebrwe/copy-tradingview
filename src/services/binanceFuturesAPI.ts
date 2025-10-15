import CryptoJS from 'crypto-js';

// 바이낸스 선물 API 설정
const FUTURES_API_BASE_URL = 'https://fapi.binance.com';

interface BinanceFuturesConfig {
  apiKey: string;
  apiSecret: string;
}

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

interface OrderParams {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP_MARKET';
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
}

/**
 * 선물 주문 생성
 */
const createOrder = async (params: OrderParams) => {
  if (!config.apiKey || !config.apiSecret) {
    throw new Error('API credentials not set. Please call setApiCredentials first.');
  }

  const timestamp = getTimestamp();

  // 쿼리 파라미터 구성
  const queryParams: any = {
    symbol: params.symbol,
    side: params.side,
    type: params.type,
    quantity: params.quantity,
    timestamp,
  };

  if (params.price) queryParams.price = params.price;
  if (params.stopPrice) queryParams.stopPrice = params.stopPrice;
  if (params.timeInForce) queryParams.timeInForce = params.timeInForce;

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
};
