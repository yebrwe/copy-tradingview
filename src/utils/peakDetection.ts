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
 * 1시간봉 기준으로 주요 고점을 찾음
 * - 최근 6시간(6개 캔들) 중 최고점
 * - 최근 15일(360개 캔들) 중 최고점
 * @param candles 캔들스틱 데이터 배열 (1시간봉 기준)
 * @returns [6시간 최고점, 15일 최고점] 또는 빈 배열
 */
export function findMajorPeaks(candles: CandlestickData[]): Peak[] {
  const SIX_HOURS = 6; // 6개 캔들
  const FIFTEEN_DAYS = 15 * 24; // 360개 캔들

  if (candles.length < SIX_HOURS) {
    console.warn('Not enough data for 6-hour period');
    return [];
  }

  // 1. 최근 6시간 중 최고점 찾기
  let sixHourPeak: Peak | null = null;
  let sixHourMax = -Infinity;

  const sixHourStart = Math.max(0, candles.length - SIX_HOURS);
  for (let i = sixHourStart; i < candles.length; i++) {
    if (candles[i].high > sixHourMax) {
      sixHourMax = candles[i].high;
      sixHourPeak = {
        index: i,
        time: candles[i].time,
        price: candles[i].high,
      };
    }
  }

  // 2. 최근 15일 중 최고점 찾기
  let fifteenDayPeak: Peak | null = null;
  let fifteenDayMax = -Infinity;

  const fifteenDayStart = Math.max(0, candles.length - FIFTEEN_DAYS);
  for (let i = fifteenDayStart; i < candles.length; i++) {
    if (candles[i].high > fifteenDayMax) {
      fifteenDayMax = candles[i].high;
      fifteenDayPeak = {
        index: i,
        time: candles[i].time,
        price: candles[i].high,
      };
    }
  }

  console.log('최근 6시간 최고점:', sixHourPeak);
  console.log('최근 15일 최고점:', fifteenDayPeak);

  // 두 고점이 같은 지점이면 15일 범위에서 두 번째 고점 찾기
  if (sixHourPeak && fifteenDayPeak && sixHourPeak.index === fifteenDayPeak.index) {
    console.log('두 고점이 동일하여 15일 범위에서 두 번째 고점을 찾습니다');

    // 15일 범위에서 가장 높은 고점을 제외한 두 번째 고점 찾기
    let secondPeak: Peak | null = null;
    let secondMax = -Infinity;

    for (let i = fifteenDayStart; i < candles.length; i++) {
      if (i !== fifteenDayPeak.index && candles[i].high > secondMax) {
        secondMax = candles[i].high;
        secondPeak = {
          index: i,
          time: candles[i].time,
          price: candles[i].high,
        };
      }
    }

    if (secondPeak) {
      console.log('15일 범위 두 번째 고점:', secondPeak);
      return [sixHourPeak, secondPeak];
    }
  }

  if (sixHourPeak && fifteenDayPeak) {
    return [sixHourPeak, fifteenDayPeak];
  }

  if (sixHourPeak) {
    return [sixHourPeak];
  }

  return [];
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
