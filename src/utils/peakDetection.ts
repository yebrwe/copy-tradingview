import type { CandlestickData } from '../types/trading.types';

export interface Peak {
  index: number;
  time: number;
  price: number;
}

/**
 * 주요 고점(Peak)을 감지하는 알고리즘
 * @param candles 캔들스틱 데이터 배열
 * @param lookback 좌우로 확인할 캔들 개수 (기본: 5)
 * @param minPeaks 최소 피크 개수 (기본: 2)
 * @returns 감지된 고점 배열
 */
export function detectPeaks(
  candles: CandlestickData[],
  lookback: number = 5,
  minPeaks: number = 2
): Peak[] {
  if (candles.length < lookback * 2 + 1) {
    return [];
  }

  const peaks: Peak[] = [];

  // 각 캔들에 대해 고점인지 확인
  for (let i = lookback; i < candles.length - lookback; i++) {
    const currentHigh = candles[i].high;
    let isPeak = true;

    // 좌우 lookback 범위 내에서 현재 고점보다 높은 값이 있는지 확인
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j !== i && candles[j].high > currentHigh) {
        isPeak = false;
        break;
      }
    }

    if (isPeak) {
      peaks.push({
        index: i,
        time: candles[i].time,
        price: currentHigh,
      });
    }
  }

  // 가격이 높은 순으로 정렬
  peaks.sort((a, b) => b.price - a.price);

  // 상위 N개의 주요 고점만 반환
  return peaks.slice(0, Math.max(minPeaks, 3));
}

/**
 * 수직 상승률을 계산하는 함수
 * @param candles 캔들스틱 데이터 배열
 * @param lookback 이전 몇 개 캔들을 볼지
 * @returns 각 캔들의 수직 상승률 배열
 */
function calculateVerticalRiseRate(
  candles: CandlestickData[],
  lookback: number = 10
): { index: number; riseRate: number; high: number }[] {
  const rates: { index: number; riseRate: number; high: number }[] = [];

  for (let i = lookback; i < candles.length; i++) {
    // 이전 lookback 개 캔들 중 최저가 찾기
    let minLow = Infinity;
    for (let j = i - lookback; j < i; j++) {
      minLow = Math.min(minLow, candles[j].low);
    }

    // 현재 캔들의 최고가
    const currentHigh = candles[i].high;

    // 상승률 계산 (%)
    const riseRate = ((currentHigh - minLow) / minLow) * 100;

    rates.push({
      index: i,
      riseRate,
      high: currentHigh,
    });
  }

  return rates;
}

/**
 * 1시간봉 기준으로 주요 고점을 찾음 (하락 추세용)
 * - 15일 범위 전체에서 가장 높은 고점 (1위)
 * - 15일 범위 전체에서 두 번째로 높은 고점 (2위)
 * - 이 두 고점을 시간순으로 연결
 * @param candles 캔들스틱 데이터 배열 (1시간봉 기준)
 * @returns [첫 번째 고점, 두 번째 고점] (시간순 정렬) 또는 빈 배열
 */
export function findMajorPeaks(candles: CandlestickData[]): Peak[] {
  const FIFTEEN_DAYS = 15 * 24; // 360개 캔들

  if (candles.length < 24) {
    console.warn('Not enough data for peak detection');
    return [];
  }

  const fifteenDayStart = Math.max(0, candles.length - FIFTEEN_DAYS);
  const currentIndex = candles.length - 1;
  const lookback = 5;

  // 1단계: 15일 범위에서 절대 최고점 찾기 (종가 기준)
  let absoluteHighest: Peak | null = null;
  let maxPrice = -Infinity;

  for (let i = fifteenDayStart; i < candles.length; i++) {
    if (candles[i].close > maxPrice) {
      maxPrice = candles[i].close;
      absoluteHighest = {
        index: i,
        time: candles[i].time,
        price: candles[i].close,
      };
    }
  }

  if (!absoluteHighest) {
    console.warn('최고점을 찾을 수 없음');
    return [];
  }

  console.log('15일 범위 절대 최고점:', absoluteHighest);

  // 2단계: 최고점 이후부터 현재까지 범위에서 확정된 고점들만 찾기 (종가 기준)
  const peaksAfterHighest: Peak[] = [];
  const searchStart = absoluteHighest.index + 1;

  // 현재 캔들(마지막 1개)만 미확정이므로, 현재 캔들 전까지만 검색
  const searchEnd = candles.length - 1;

  // 15일 최고점 이후부터 현재 캔들 직전까지 검색
  for (let i = searchStart; i < searchEnd; i++) {
    const currentClose = candles[i].close;
    let isPeak = true;

    // 좌측 lookback 범위 확인
    const leftStart = Math.max(0, i - lookback);
    for (let j = leftStart; j < i; j++) {
      if (candles[j].close > currentClose) {
        isPeak = false;
        break;
      }
    }

    // 우측 lookback 범위 확인 (현재 캔들 전까지의 확정된 데이터로)
    if (isPeak) {
      const rightEnd = Math.min(searchEnd - 1, i + lookback);
      for (let j = i + 1; j <= rightEnd; j++) {
        if (candles[j].close > currentClose) {
          isPeak = false;
          break;
        }
      }
    }

    if (isPeak) {
      peaksAfterHighest.push({
        index: i,
        time: candles[i].time,
        price: currentClose,
      });
    }
  }

  if (peaksAfterHighest.length === 0) {
    console.warn('최고점 이후 고점을 찾을 수 없음');
    return [absoluteHighest];
  }

  console.log('최고점 이후 발견된 고점들:', peaksAfterHighest);

  // 3단계: 재귀적으로 고점 찾기 - 중간점보다 현재 캔들 쪽에 있는 가장 높은 고점 선택
  const minGapFromHighest = 24;

  // 최고점과 최소 간격 이상 떨어진 고점들만 필터링
  const validPeaks = peaksAfterHighest.filter(peak =>
    peak.index - absoluteHighest.index >= minGapFromHighest
  );

  let secondPeak: Peak | null = null;

  if (validPeaks.length > 0) {
    // 중간점 계산: 최고점과 현재 캔들의 중간
    const midpoint = (absoluteHighest.index + currentIndex) / 2;

    // 고점들을 가격 순으로 정렬 (높은 것부터)
    const sortedPeaks = [...validPeaks].sort((a, b) => b.price - a.price);

    // 재귀적으로 탐색: 가장 높은 것부터 확인하되, 중간점보다 현재 캔들 쪽에 있는 것을 찾음
    for (const peak of sortedPeaks) {
      if (peak.index > midpoint) {
        // 중간점보다 현재 캔들 쪽에 있음 → 선택!
        secondPeak = peak;
        console.log('선택된 두 번째 고점 (중간점 기준, 현재 캔들 쪽):', secondPeak, {
          price: secondPeak.price,
          peakIndex: peak.index,
          midpoint: midpoint,
          distanceFromHighest: peak.index - absoluteHighest.index,
          distanceFromCurrent: currentIndex - peak.index,
          isCloserToCurrent: peak.index > midpoint
        });
        break;
      }
    }

    // 중간점보다 현재 쪽에 있는 고점이 없으면, 가장 높은 고점 선택
    if (!secondPeak && sortedPeaks.length > 0) {
      secondPeak = sortedPeaks[0];
      console.warn('중간점 조건을 만족하는 고점 없음, 가장 높은 고점 선택:', secondPeak);
    }
  } else {
    // 최소 간격 조건을 만족하는 고점이 없으면, 모든 고점 중 탐색
    console.warn('최소 간격 조건을 만족하는 고점이 없음, 모든 고점 중 선택');

    const midpoint = (absoluteHighest.index + currentIndex) / 2;
    const sortedPeaks = [...peaksAfterHighest].sort((a, b) => b.price - a.price);

    for (const peak of sortedPeaks) {
      if (peak.index > midpoint) {
        secondPeak = peak;
        console.log('선택된 두 번째 고점 (간격 무시, 중간점 기준):', secondPeak);
        break;
      }
    }

    if (!secondPeak && sortedPeaks.length > 0) {
      secondPeak = sortedPeaks[0];
      console.warn('조건 만족하는 고점 없음, 가장 높은 고점 선택');
    }
  }

  if (!secondPeak) {
    console.warn('두 번째 고점을 찾을 수 없음');
    return [absoluteHighest];
  }

  // 시간순으로 정렬하여 반환
  const peaks = [absoluteHighest, secondPeak];
  peaks.sort((a, b) => a.time - b.time);

  console.log('최종 고점 연결 (시간순):', peaks);
  return peaks;
}

/**
 * 고점들을 시간 순으로 정렬
 */
export function sortPeaksByTime(peaks: Peak[]): Peak[] {
  return [...peaks].sort((a, b) => a.time - b.time);
}

/**
 * 전체 데이터에서 역대 최저점 찾기
 * @param candles 캔들스틱 데이터 배열 (1시간봉 기준)
 * @returns 역대 최저점
 */
export function findAllTimeLow(candles: CandlestickData[]): Peak | null {
  if (candles.length === 0) {
    return null;
  }

  let allTimeLow: Peak | null = null;
  let minPrice = Infinity;

  // 전체 데이터에서 최저점 찾기
  for (let i = 0; i < candles.length; i++) {
    if (candles[i].low < minPrice) {
      minPrice = candles[i].low;
      allTimeLow = {
        index: i,
        time: candles[i].time,
        price: candles[i].low,
      };
    }
  }

  console.log('역대 최저점:', allTimeLow);
  return allTimeLow;
}

/**
 * 1시간봉 기준으로 주요 저점을 찾음 (상승 추세용)
 * - 15일 범위 전체에서 가장 낮은 저점 (1위)
 * - 15일 범위 전체에서 두 번째로 낮은 저점 (2위)
 * - 이 두 저점을 시간순으로 연결
 * @param candles 캔들스틱 데이터 배열 (1시간봉 기준)
 * @returns [첫 번째 저점, 두 번째 저점] (시간순 정렬) 또는 빈 배열
 */
export function findMajorLows(candles: CandlestickData[]): Peak[] {
  const FIFTEEN_DAYS = 15 * 24; // 360개 캔들

  if (candles.length < 24) {
    console.warn('Not enough data for low detection');
    return [];
  }

  const fifteenDayStart = Math.max(0, candles.length - FIFTEEN_DAYS);
  const currentIndex = candles.length - 1;
  const lookback = 5;

  // 1단계: 15일 범위에서 절대 최저점 찾기 (종가 기준)
  let absoluteLowest: Peak | null = null;
  let minPrice = Infinity;

  for (let i = fifteenDayStart; i < candles.length; i++) {
    if (candles[i].close < minPrice) {
      minPrice = candles[i].close;
      absoluteLowest = {
        index: i,
        time: candles[i].time,
        price: candles[i].close,
      };
    }
  }

  if (!absoluteLowest) {
    console.warn('최저점을 찾을 수 없음');
    return [];
  }

  console.log('15일 범위 절대 최저점:', absoluteLowest);

  // 2단계: 최저점 이후부터 현재까지 범위에서 확정된 저점들만 찾기 (종가 기준)
  const lowsAfterLowest: Peak[] = [];
  const searchStart = absoluteLowest.index + 1;

  // 현재 캔들(마지막 1개)만 미확정이므로, 현재 캔들 전까지만 검색
  const searchEnd = candles.length - 1;

  // 15일 최저점 이후부터 현재 캔들 직전까지 검색
  for (let i = searchStart; i < searchEnd; i++) {
    const currentClose = candles[i].close;
    let isLow = true;

    // 좌측 lookback 범위 확인
    const leftStart = Math.max(0, i - lookback);
    for (let j = leftStart; j < i; j++) {
      if (candles[j].close < currentClose) {
        isLow = false;
        break;
      }
    }

    // 우측 lookback 범위 확인 (현재 캔들 전까지의 확정된 데이터로)
    if (isLow) {
      const rightEnd = Math.min(searchEnd - 1, i + lookback);
      for (let j = i + 1; j <= rightEnd; j++) {
        if (candles[j].close < currentClose) {
          isLow = false;
          break;
        }
      }
    }

    if (isLow) {
      lowsAfterLowest.push({
        index: i,
        time: candles[i].time,
        price: currentClose,
      });
    }
  }

  if (lowsAfterLowest.length === 0) {
    console.warn('최저점 이후 저점을 찾을 수 없음');
    return [absoluteLowest];
  }

  console.log('최저점 이후 발견된 저점들:', lowsAfterLowest);

  // 3단계: 재귀적으로 저점 찾기 - 중간점보다 현재 캔들 쪽에 있는 가장 낮은 저점 선택
  const minGapFromLowest = 24;

  // 최저점과 최소 간격 이상 떨어진 저점들만 필터링
  const validLows = lowsAfterLowest.filter(low =>
    low.index - absoluteLowest.index >= minGapFromLowest
  );

  let secondLow: Peak | null = null;

  if (validLows.length > 0) {
    // 중간점 계산: 최저점과 현재 캔들의 중간
    const midpoint = (absoluteLowest.index + currentIndex) / 2;

    // 저점들을 가격 순으로 정렬 (낮은 것부터)
    const sortedLows = [...validLows].sort((a, b) => a.price - b.price);

    // 재귀적으로 탐색: 가장 낮은 것부터 확인하되, 중간점보다 현재 캔들 쪽에 있는 것을 찾음
    for (const low of sortedLows) {
      if (low.index > midpoint) {
        // 중간점보다 현재 캔들 쪽에 있음 → 선택!
        secondLow = low;
        console.log('선택된 두 번째 저점 (중간점 기준, 현재 캔들 쪽):', secondLow, {
          price: secondLow.price,
          lowIndex: low.index,
          midpoint: midpoint,
          distanceFromLowest: low.index - absoluteLowest.index,
          distanceFromCurrent: currentIndex - low.index,
          isCloserToCurrent: low.index > midpoint
        });
        break;
      }
    }

    // 중간점보다 현재 쪽에 있는 저점이 없으면, 가장 낮은 저점 선택
    if (!secondLow && sortedLows.length > 0) {
      secondLow = sortedLows[0];
      console.warn('중간점 조건을 만족하는 저점 없음, 가장 낮은 저점 선택:', secondLow);
    }
  } else {
    // 최소 간격 조건을 만족하는 저점이 없으면, 모든 저점 중 탐색
    console.warn('최소 간격 조건을 만족하는 저점이 없음, 모든 저점 중 선택');

    const midpoint = (absoluteLowest.index + currentIndex) / 2;
    const sortedLows = [...lowsAfterLowest].sort((a, b) => a.price - b.price);

    for (const low of sortedLows) {
      if (low.index > midpoint) {
        secondLow = low;
        console.log('선택된 두 번째 저점 (간격 무시, 중간점 기준):', secondLow);
        break;
      }
    }

    if (!secondLow && sortedLows.length > 0) {
      secondLow = sortedLows[0];
      console.warn('조건 만족하는 저점 없음, 가장 낮은 저점 선택');
    }
  }

  if (!secondLow) {
    console.warn('두 번째 저점을 찾을 수 없음');
    return [absoluteLowest];
  }

  // 시간순으로 정렬하여 반환
  const lows = [absoluteLowest, secondLow];
  lows.sort((a, b) => a.time - b.time);

  console.log('최종 저점 연결 (시간순):', lows);
  return lows;
}

/**
 * 전체 데이터에서 역대 최고점 찾기
 * @param candles 캔들스틱 데이터 배열 (1시간봉 기준)
 * @returns 역대 최고점
 */
export function findAllTimeHigh(candles: CandlestickData[]): Peak | null {
  if (candles.length === 0) {
    return null;
  }

  let allTimeHigh: Peak | null = null;
  let maxPrice = -Infinity;

  // 전체 데이터에서 최고점 찾기
  for (let i = 0; i < candles.length; i++) {
    if (candles[i].high > maxPrice) {
      maxPrice = candles[i].high;
      allTimeHigh = {
        index: i,
        time: candles[i].time,
        price: candles[i].high,
      };
    }
  }

  console.log('역대 최고점:', allTimeHigh);
  return allTimeHigh;
}

/**
 * MA200 터치 지점에서 고점 찾기 (돌파 후 재설정용)
 * @param candles 캔들스틱 데이터 배열
 * @param ma200Values MA200 값 배열 (시간순)
 * @returns 시간순으로 정렬된 고점 2개
 */
export function findPeaksNearMA200(
  candles: CandlestickData[],
  ma200Values: Array<{ time: number; value: number }>
): Peak[] {
  if (candles.length < 200 || ma200Values.length === 0) {
    console.warn('MA200 터치 지점 탐색을 위한 데이터 부족');
    return [];
  }

  // MA200 터치 허용 범위 (±2% 이내)
  const TOUCH_THRESHOLD = 0.02;

  // MA200 근처의 고점들 찾기
  const touchPeaks: Peak[] = [];

  // MA200 값이 있는 범위에서만 검색
  const startIndex = Math.max(0, candles.length - ma200Values.length);

  for (let i = startIndex; i < candles.length; i++) {
    const candle = candles[i];

    // 해당 시간의 MA200 값 찾기
    const ma200Entry = ma200Values.find(m => m.time === candle.time);
    if (!ma200Entry) continue;

    const ma200Price = ma200Entry.value;

    // 캔들의 고가가 MA200 근처인지 확인 (터치 또는 교차)
    const highDiff = Math.abs(candle.high - ma200Price) / ma200Price;
    const lowDiff = Math.abs(candle.low - ma200Price) / ma200Price;

    // 고가나 저가가 MA200 근처이면 (터치 또는 교차)
    if (highDiff <= TOUCH_THRESHOLD || lowDiff <= TOUCH_THRESHOLD ||
        (candle.low <= ma200Price && candle.high >= ma200Price)) {
      touchPeaks.push({
        index: i,
        time: candle.time,
        price: candle.high,
      });
    }
  }

  if (touchPeaks.length === 0) {
    console.warn('MA200 터치 지점을 찾을 수 없음');
    return [];
  }

  console.log('MA200 터치 지점 발견:', touchPeaks.length, '개');

  // 최근 15일 범위로 제한
  const FIFTEEN_DAYS = 15 * 24;
  const recentStart = Math.max(0, candles.length - FIFTEEN_DAYS);
  const recentPeaks = touchPeaks.filter(p => p.index >= recentStart);

  if (recentPeaks.length === 0) {
    console.warn('최근 15일 내 MA200 터치 지점 없음');
    return [];
  }

  // 가격 순으로 정렬하여 가장 높은 2개 선택
  const sortedByPrice = [...recentPeaks].sort((a, b) => b.price - a.price);
  const topPeaks = sortedByPrice.slice(0, Math.min(2, sortedByPrice.length));

  // 시간순으로 정렬
  topPeaks.sort((a, b) => a.time - b.time);

  console.log('MA200 터치 기반 고점 선택:', topPeaks);

  return topPeaks;
}
