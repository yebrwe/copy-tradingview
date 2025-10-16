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

  // 1단계: 15일 범위에서 절대 최고점 찾기
  let absoluteHighest: Peak | null = null;
  let maxPrice = -Infinity;

  for (let i = fifteenDayStart; i < candles.length; i++) {
    if (candles[i].high > maxPrice) {
      maxPrice = candles[i].high;
      absoluteHighest = {
        index: i,
        time: candles[i].time,
        price: candles[i].high,
      };
    }
  }

  if (!absoluteHighest) {
    console.warn('최고점을 찾을 수 없음');
    return [];
  }

  console.log('15일 범위 절대 최고점:', absoluteHighest);

  // 2단계: 최고점 이후부터 현재까지 범위에서 모든 고점들 찾기
  const peaksAfterHighest: Peak[] = [];
  const searchStart = absoluteHighest.index + 1;

  for (let i = searchStart; i < candles.length - lookback; i++) {
    const currentHigh = candles[i].high;
    let isPeak = true;

    // 좌우 lookback 범위에서 고점인지 확인
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j !== i && j >= 0 && j < candles.length && candles[j].high > currentHigh) {
        isPeak = false;
        break;
      }
    }

    if (isPeak) {
      peaksAfterHighest.push({
        index: i,
        time: candles[i].time,
        price: currentHigh,
      });
    }
  }

  // 현재 시점(마지막 캔들)도 고점인지 체크 (우측 확인 없이)
  if (currentIndex > absoluteHighest.index) {
    const currentHigh = candles[currentIndex].high;
    let isCurrentPeak = true;

    for (let j = Math.max(0, currentIndex - lookback); j < currentIndex; j++) {
      if (candles[j].high > currentHigh) {
        isCurrentPeak = false;
        break;
      }
    }

    if (isCurrentPeak) {
      peaksAfterHighest.push({
        index: currentIndex,
        time: candles[currentIndex].time,
        price: currentHigh,
      });
    }
  }

  if (peaksAfterHighest.length === 0) {
    console.warn('최고점 이후 고점을 찾을 수 없음');
    return [absoluteHighest];
  }

  console.log('최고점 이후 발견된 고점들:', peaksAfterHighest);

  // 3단계: 최고점 이후의 고점들 중 현재 시점에 가장 가까운 것을 두 번째 고점으로 선택
  // 단, 최고점과 너무 가까운 것은 제외 (최소 24시간 = 24개 캔들 간격)
  const minGapFromHighest = 24;

  let secondPeak: Peak | null = null;
  let minDistanceFromCurrent = Infinity;

  for (const peak of peaksAfterHighest) {
    const gapFromHighest = peak.index - absoluteHighest.index;
    const distanceFromCurrent = currentIndex - peak.index;

    // 최고점과 최소 간격 이상 떨어져 있어야 함
    if (gapFromHighest >= minGapFromHighest) {
      if (distanceFromCurrent < minDistanceFromCurrent) {
        minDistanceFromCurrent = distanceFromCurrent;
        secondPeak = peak;
      }
    }
  }

  // 최소 간격 조건을 만족하는 고점이 없으면, 가장 가까운 고점 선택
  if (!secondPeak && peaksAfterHighest.length > 0) {
    secondPeak = peaksAfterHighest.reduce((closest, peak) => {
      const distCurrent = currentIndex - peak.index;
      const distClosest = currentIndex - closest.index;
      return distCurrent < distClosest ? peak : closest;
    });
    console.warn('최소 간격 조건을 만족하는 고점이 없어 가장 가까운 고점 선택');
  }

  if (!secondPeak) {
    console.warn('두 번째 고점을 찾을 수 없음');
    return [absoluteHighest];
  }

  console.log('선택된 두 번째 고점 (현재에 가장 가까움):', secondPeak, {
    distanceFromCurrent: currentIndex - secondPeak.index,
    gapFromHighest: secondPeak.index - absoluteHighest.index
  });

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
 * 최근 15일 범위에서 최저점 찾기
 * @param candles 캔들스틱 데이터 배열 (1시간봉 기준)
 * @returns 최근 15일 최저점
 */
export function findAllTimeLow(candles: CandlestickData[]): Peak | null {
  const FIFTEEN_DAYS = 15 * 24; // 360개 캔들

  if (candles.length === 0) {
    return null;
  }

  let allTimeLow: Peak | null = null;
  let minPrice = Infinity;

  // 최근 15일 범위에서 최저점 찾기
  const fifteenDayStart = Math.max(0, candles.length - FIFTEEN_DAYS);
  for (let i = fifteenDayStart; i < candles.length; i++) {
    if (candles[i].low < minPrice) {
      minPrice = candles[i].low;
      allTimeLow = {
        index: i,
        time: candles[i].time,
        price: candles[i].low,
      };
    }
  }

  console.log('최근 15일 최저점:', allTimeLow);
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

  // 1단계: 15일 범위에서 절대 최저점 찾기
  let absoluteLowest: Peak | null = null;
  let minPrice = Infinity;

  for (let i = fifteenDayStart; i < candles.length; i++) {
    if (candles[i].low < minPrice) {
      minPrice = candles[i].low;
      absoluteLowest = {
        index: i,
        time: candles[i].time,
        price: candles[i].low,
      };
    }
  }

  if (!absoluteLowest) {
    console.warn('최저점을 찾을 수 없음');
    return [];
  }

  console.log('15일 범위 절대 최저점:', absoluteLowest);

  // 2단계: 최저점 이후부터 현재까지 범위에서 모든 저점들 찾기
  const lowsAfterLowest: Peak[] = [];
  const searchStart = absoluteLowest.index + 1;

  for (let i = searchStart; i < candles.length - lookback; i++) {
    const currentLowPrice = candles[i].low;
    let isLow = true;

    // 좌우 lookback 범위에서 저점인지 확인
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j !== i && j >= 0 && j < candles.length && candles[j].low < currentLowPrice) {
        isLow = false;
        break;
      }
    }

    if (isLow) {
      lowsAfterLowest.push({
        index: i,
        time: candles[i].time,
        price: currentLowPrice,
      });
    }
  }

  // 현재 시점(마지막 캔들)도 저점인지 체크 (우측 확인 없이)
  if (currentIndex > absoluteLowest.index) {
    const currentLowPrice = candles[currentIndex].low;
    let isCurrentLow = true;

    for (let j = Math.max(0, currentIndex - lookback); j < currentIndex; j++) {
      if (candles[j].low < currentLowPrice) {
        isCurrentLow = false;
        break;
      }
    }

    if (isCurrentLow) {
      lowsAfterLowest.push({
        index: currentIndex,
        time: candles[currentIndex].time,
        price: currentLowPrice,
      });
    }
  }

  if (lowsAfterLowest.length === 0) {
    console.warn('최저점 이후 저점을 찾을 수 없음');
    return [absoluteLowest];
  }

  console.log('최저점 이후 발견된 저점들:', lowsAfterLowest);

  // 3단계: 최저점 이후의 저점들 중 현재 시점에 가장 가까운 것을 두 번째 저점으로 선택
  // 단, 최저점과 너무 가까운 것은 제외 (최소 24시간 = 24개 캔들 간격)
  const minGapFromLowest = 24;

  let secondLow: Peak | null = null;
  let minDistanceFromCurrent = Infinity;

  for (const low of lowsAfterLowest) {
    const gapFromLowest = low.index - absoluteLowest.index;
    const distanceFromCurrent = currentIndex - low.index;

    // 최저점과 최소 간격 이상 떨어져 있어야 함
    if (gapFromLowest >= minGapFromLowest) {
      if (distanceFromCurrent < minDistanceFromCurrent) {
        minDistanceFromCurrent = distanceFromCurrent;
        secondLow = low;
      }
    }
  }

  // 최소 간격 조건을 만족하는 저점이 없으면, 가장 가까운 저점 선택
  if (!secondLow && lowsAfterLowest.length > 0) {
    secondLow = lowsAfterLowest.reduce((closest, low) => {
      const distCurrent = currentIndex - low.index;
      const distClosest = currentIndex - closest.index;
      return distCurrent < distClosest ? low : closest;
    });
    console.warn('최소 간격 조건을 만족하는 저점이 없어 가장 가까운 저점 선택');
  }

  if (!secondLow) {
    console.warn('두 번째 저점을 찾을 수 없음');
    return [absoluteLowest];
  }

  console.log('선택된 두 번째 저점 (현재에 가장 가까움):', secondLow, {
    distanceFromCurrent: currentIndex - secondLow.index,
    gapFromLowest: secondLow.index - absoluteLowest.index
  });

  // 시간순으로 정렬하여 반환
  const lows = [absoluteLowest, secondLow];
  lows.sort((a, b) => a.time - b.time);

  console.log('최종 저점 연결 (시간순):', lows);
  return lows;
}

/**
 * 최근 15일 범위에서 최고점 찾기
 * @param candles 캔들스틱 데이터 배열 (1시간봉 기준)
 * @returns 최근 15일 최고점
 */
export function findAllTimeHigh(candles: CandlestickData[]): Peak | null {
  const FIFTEEN_DAYS = 15 * 24; // 360개 캔들

  if (candles.length === 0) {
    return null;
  }

  let allTimeHigh: Peak | null = null;
  let maxPrice = -Infinity;

  // 최근 15일 범위에서 최고점 찾기
  const fifteenDayStart = Math.max(0, candles.length - FIFTEEN_DAYS);
  for (let i = fifteenDayStart; i < candles.length; i++) {
    if (candles[i].high > maxPrice) {
      maxPrice = candles[i].high;
      allTimeHigh = {
        index: i,
        time: candles[i].time,
        price: candles[i].high,
      };
    }
  }

  console.log('최근 15일 최고점:', allTimeHigh);
  return allTimeHigh;
}
