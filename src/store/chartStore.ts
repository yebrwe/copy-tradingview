import { create } from 'zustand';
import type {
  CandlestickData,
  VolumeData,
  TimeFrame,
  DrawingTool,
  Drawing
} from '../types/trading.types';
import { findMajorPeaks, sortPeaksByTime, findAllTimeLow, findMajorLows, findAllTimeHigh } from '../utils/peakDetection';

interface EntryPoints {
  shortEntry: number | null;
  longEntry: number | null;
}

interface RecommendedEntry {
  price: number;
  type: 'long' | 'short';
  channel: 'high' | 'low';
  priority: 'primary' | 'secondary';
}

type ChannelPattern = 'ascending' | 'descending' | 'symmetrical' | 'ranging' | 'none';

interface LineData {
  time: number;
  value: number;
}

interface ChartState {
  // 차트 데이터
  candlestickData: CandlestickData[];
  volumeData: VolumeData[];
  ma200Data: LineData[]; // MA200 이동평균선 데이터

  // 백테스팅
  isBacktesting: boolean;
  fullCandlestickData: CandlestickData[];
  fullVolumeData: VolumeData[];
  backtestingIndex: number; // 현재 보여줄 마지막 캔들의 인덱스

  // 설정
  symbol: string;
  timeFrame: TimeFrame;

  // 그리기 도구
  selectedTool: DrawingTool;
  drawings: Drawing[];

  // 진입점
  highChannelEntryPoints: EntryPoints;
  lowChannelEntryPoints: EntryPoints;

  // 채널 패턴 분류
  channelPattern: ChannelPattern;

  // 추천 진입점 (확률 높은 2개)
  recommendedEntries: RecommendedEntry[];

  // 채널 돌파 상태 (null: 채널 내부, 'upper': 상단 돌파, 'lower': 하단 돌파)
  channelBreakout: 'upper' | 'lower' | null;

  // 액션
  setCandlestickData: (data: CandlestickData[]) => void;
  updateLastCandle: (candle: CandlestickData) => void;
  addCandle: (candle: CandlestickData) => void;
  setVolumeData: (data: VolumeData[]) => void;
  setTimeFrame: (timeFrame: TimeFrame) => void;
  setSelectedTool: (tool: DrawingTool) => void;
  addDrawing: (drawing: Drawing) => void;
  removeDrawing: (id: string) => void;
  clearDrawings: () => void;
  connectMajorPeaks: () => void;
  connectMajorLows: () => void;
  calculateHighChannelEntryPoints: () => void;
  calculateLowChannelEntryPoints: () => void;
  classifyChannelPattern: () => void;
  calculateRecommendedEntries: () => void;
  checkChannelBreakout: () => void;

  // 백테스팅 액션
  startBacktesting: () => void;
  stopBacktesting: () => void;
  setBacktestingIndex: (index: number) => void;
  recalculateChannels: () => void;
}

// MA200 계산 헬퍼 함수
const calculateMA200 = (candlestickData: CandlestickData[]): LineData[] => {
  const ma200Period = 200;
  const result: LineData[] = [];

  if (candlestickData.length < ma200Period) {
    return result; // 데이터가 부족하면 빈 배열 반환
  }

  // MA200을 각 캔들에 대해 계산
  for (let i = ma200Period - 1; i < candlestickData.length; i++) {
    let sum = 0;
    for (let j = i - ma200Period + 1; j <= i; j++) {
      sum += candlestickData[j].close;
    }
    const ma200Value = sum / ma200Period;
    result.push({
      time: candlestickData[i].time,
      value: ma200Value,
    });
  }

  return result;
};

export const useChartStore = create<ChartState>((set, get) => ({
  // 초기 상태
  candlestickData: [],
  volumeData: [],
  ma200Data: [],
  isBacktesting: false,
  fullCandlestickData: [],
  fullVolumeData: [],
  backtestingIndex: 0,
  symbol: 'ETHUSDT',
  timeFrame: '1h', // 1시간봉으로 기본값 설정
  selectedTool: 'none',
  drawings: [],
  highChannelEntryPoints: {
    shortEntry: null,
    longEntry: null,
  },
  lowChannelEntryPoints: {
    shortEntry: null,
    longEntry: null,
  },
  channelPattern: 'none',
  recommendedEntries: [],
  channelBreakout: null,

  // 액션들
  setCandlestickData: (data) => {
    const ma200Data = calculateMA200(data);
    set({ candlestickData: data, ma200Data });
  },

  updateLastCandle: (candle) => set((state) => {
    const data = [...state.candlestickData];
    if (data.length > 0) {
      data[data.length - 1] = candle;
    }
    const ma200Data = calculateMA200(data);
    return { candlestickData: data, ma200Data };
  }),

  addCandle: (candle) => set((state) => {
    const data = [...state.candlestickData, candle];
    const ma200Data = calculateMA200(data);
    return { candlestickData: data, ma200Data };
  }),

  setVolumeData: (data) => set({ volumeData: data }),

  setTimeFrame: (timeFrame) => set({
    timeFrame,
    candlestickData: [], // 타임프레임 변경시 데이터 초기화
    volumeData: [],
    ma200Data: []
  }),

  setSelectedTool: (tool) => set({ selectedTool: tool }),

  addDrawing: (drawing) => set((state) => ({
    drawings: [...state.drawings, drawing]
  })),

  removeDrawing: (id) => set((state) => ({
    drawings: state.drawings.filter(d => d.id !== id)
  })),

  clearDrawings: () => set({ drawings: [], channelBreakout: null }),

  connectMajorPeaks: () => set((state) => {
    const { candlestickData, channelBreakout } = state;

    // 돌파 후 재설정인지 확인
    const isAfterBreakout = channelBreakout !== null;

    if (isAfterBreakout) {
      console.log('🔄 채널 돌파 후 재설정: ATH + 현재 MA200 기반 채널 생성');
    }

    // MA200 계산
    const ma200Period = 200;
    let ma200 = 0;
    if (candlestickData.length >= ma200Period) {
      let sum = 0;
      for (let i = candlestickData.length - ma200Period; i < candlestickData.length; i++) {
        sum += candlestickData[i].close;
      }
      ma200 = sum / ma200Period;
    } else {
      let sum = 0;
      for (const candle of candlestickData) {
        sum += candle.close;
      }
      ma200 = sum / candlestickData.length;
    }

    const currentPrice = candlestickData[candlestickData.length - 1].close;
    const isPriceAboveMA200 = currentPrice > ma200;

    console.log('Peak connection strategy:', {
      currentPrice,
      ma200,
      isPriceAboveMA200,
      isAfterBreakout,
      strategy: isAfterBreakout
        ? 'ATH + 현재 MA200'
        : (isPriceAboveMA200
          ? '최고점 + 최고점 왼쪽(과거) 고점 연결'
          : '기존 알고리즘 (6시간 & 15일 고점)')
    });

    let sortedPeaks: Array<{ time: number; price: number }>;

    if (isAfterBreakout) {
      // 돌파 후 재설정: ATH + 현재 MA200 연결
      const allTimeHigh = findAllTimeHigh(candlestickData);
      if (!allTimeHigh) {
        console.warn('Cannot find all-time high');
        return state;
      }

      const currentTime = candlestickData[candlestickData.length - 1].time;

      sortedPeaks = [
        { time: allTimeHigh.time, price: allTimeHigh.price },
        { time: currentTime, price: ma200 }
      ];

      console.log('채널 돌파 후 재설정: ATH → 현재 MA200', {
        ath: sortedPeaks[0],
        ma200Point: sortedPeaks[1],
        breakoutType: channelBreakout
      });

    } else if (isPriceAboveMA200) {
      // MA200 위: 최고점 + 최고점 왼쪽(과거)의 고점
      const allTimeHigh = findAllTimeHigh(candlestickData);
      if (!allTimeHigh) {
        console.warn('Cannot find all-time high');
        return state;
      }

      // 최고점의 인덱스 찾기
      let athIndex = -1;
      for (let i = 0; i < candlestickData.length; i++) {
        if (candlestickData[i].time === allTimeHigh.time &&
            Math.abs(candlestickData[i].high - allTimeHigh.price) < 0.01) {
          athIndex = i;
          break;
        }
      }

      if (athIndex <= 0) {
        console.warn('All-time high is at the beginning, cannot find older peak');
        return state;
      }

      // 최고점 왼쪽(과거) 영역에서 고점 찾기
      const leftCandles = candlestickData.slice(0, athIndex);
      let leftPeak = leftCandles[0];
      for (const candle of leftCandles) {
        if (candle.high > leftPeak.high) {
          leftPeak = candle;
        }
      }

      sortedPeaks = [
        { time: leftPeak.time, price: leftPeak.high },
        { time: allTimeHigh.time, price: allTimeHigh.price }
      ];

      console.log('MA200 위 전략: 왼쪽 고점 → 최고점', sortedPeaks);

    } else {
      // MA200 아래: 기존 알고리즘 (6시간 & 15일 고점)
      const peaks = findMajorPeaks(candlestickData);

      if (peaks.length < 2) {
        console.warn('Not enough peaks detected');
        return state;
      }

      // 시간 순으로 정렬
      sortedPeaks = sortPeaksByTime(peaks);
      console.log('MA200 아래 전략: 기존 알고리즘', sortedPeaks);
    }

    // 추세선 Drawing 생성 (고점 연결)
    const trendline: Drawing = {
      id: `auto-trendline-${Date.now()}`,
      type: 'trendline',
      points: sortedPeaks.map(peak => ({
        time: peak.time,
        price: peak.price,
      })),
      color: '#26a69a', // 초록 캔들 색상
      lineWidth: 1,
    };

    console.log('Major peaks connected:', sortedPeaks);

    // 역대 저점 찾기
    const allTimeLow = findAllTimeLow(state.candlestickData);

    console.log('All-time low found:', allTimeLow);
    console.log('Sorted peaks for parallel translation:', sortedPeaks);

    const newDrawings: Drawing[] = [trendline];

    // 평행선 생성 (상단 추세선을 최저점까지 평행이동)
    if (allTimeLow && sortedPeaks.length >= 2) {
      const peak1 = sortedPeaks[0];
      const peak2 = sortedPeaks[1];

      console.log('Creating parallel line...');
      console.log('Peak 1:', peak1);
      console.log('Peak 2:', peak2);
      console.log('All-time low:', allTimeLow);

      // 고점 추세선의 기울기 계산
      const priceSlope = (peak2.price - peak1.price) / (peak2.time - peak1.time);
      console.log('Price slope:', priceSlope);

      // 최저점 시간에서의 추세선 가격 계산
      const priceAtLowTime = peak1.price + priceSlope * (allTimeLow.time - peak1.time);
      console.log('Price at low time (if extended):', priceAtLowTime);

      // 평행이동 거리 = 실제 최저점 가격 - 추세선의 가격
      const verticalOffset = allTimeLow.price - priceAtLowTime;
      console.log('Vertical offset for parallel translation:', verticalOffset);

      // 추세선의 두 점을 수직으로 평행이동
      const parallelPoint1 = {
        time: peak1.time,
        price: peak1.price + verticalOffset,
      };

      const parallelPoint2 = {
        time: peak2.time,
        price: peak2.price + verticalOffset,
      };

      const parallelLine: Drawing = {
        id: `auto-parallel-${Date.now()}`,
        type: 'trendline',
        points: [parallelPoint1, parallelPoint2],
        color: '#26a69a', // 고점 채널과 동일한 초록색
        lineWidth: 1,
      };

      console.log('✓ Parallel line created (translated to all-time low):', parallelLine);
      console.log('  Point 1:', parallelPoint1);
      console.log('  Point 2:', parallelPoint2);

      newDrawings.push(parallelLine);
    } else {
      console.warn('Cannot create parallel line:', {
        hasAllTimeLow: !!allTimeLow,
        peaksLength: sortedPeaks.length
      });
    }

    // 기존 자동 생성된 고점 채널 제거 (저점 채널은 유지)
    const filteredDrawings = state.drawings.filter(d => {
      // 고점 채널 추세선 제거 (auto-trendline-로 시작하지만 -low-를 포함하지 않음)
      if (d.id.startsWith('auto-trendline-') && !d.id.includes('-low-')) {
        return false;
      }
      // 고점 채널 평행선 제거 (auto-parallel-로 시작하지만 -low-를 포함하지 않음)
      if (d.id.startsWith('auto-parallel-') && !d.id.includes('-low-')) {
        return false;
      }
      return true;
    });

    const result = {
      drawings: [...filteredDrawings, ...newDrawings],
      channelBreakout: null, // 채널 재설정 시 돌파 상태 초기화
    };

    // 진입점 계산 및 패턴 분류
    setTimeout(() => {
      get().calculateHighChannelEntryPoints();
      get().classifyChannelPattern();
    }, 0);

    return result;
  }),

  connectMajorLows: () => set((state) => {
    const lows = findMajorLows(state.candlestickData);

    if (lows.length < 2) {
      console.warn('Not enough lows detected');
      return state;
    }

    // 시간 순으로 정렬
    const sortedLows = sortPeaksByTime(lows);

    // 저점 추세선 Drawing 생성 (하단선)
    const trendline: Drawing = {
      id: `auto-trendline-low-${Date.now()}`,
      type: 'trendline',
      points: sortedLows.map(low => ({
        time: low.time,
        price: low.price,
      })),
      color: '#ef5350', // 빨간 캔들 색상
      lineWidth: 1,
    };

    console.log('Major lows connected:', sortedLows);

    const newDrawings: Drawing[] = [trendline];

    // 저점 채널의 평행선 생성 (역대 고점까지)
    const allTimeHigh = findAllTimeHigh(state.candlestickData);

    if (allTimeHigh && sortedLows.length >= 2) {
      const low1 = sortedLows[0];
      const low2 = sortedLows[1];

      // 저점 추세선의 기울기
      const lowSlope = (low2.price - low1.price) / (low2.time - low1.time);

      // 최고점 시간에서의 저점 선 가격 계산
      const priceAtHighTime = low1.price + lowSlope * (allTimeHigh.time - low1.time);

      // 평행이동 거리 = 실제 최고점 가격 - 저점 선의 가격
      const verticalOffset = allTimeHigh.price - priceAtHighTime;

      // 저점 선의 두 점을 수직으로 평행이동
      const parallelPoint1 = {
        time: low1.time,
        price: low1.price + verticalOffset,
      };

      const parallelPoint2 = {
        time: low2.time,
        price: low2.price + verticalOffset,
      };

      const parallelLine: Drawing = {
        id: `auto-parallel-low-${Date.now()}`,
        type: 'trendline',
        points: [parallelPoint1, parallelPoint2],
        color: '#ef5350', // 저점 채널과 동일한 빨간색
        lineWidth: 1,
      };

      console.log('Parallel line created (vertical translation):', parallelLine);
      console.log('Vertical offset:', verticalOffset);
      newDrawings.push(parallelLine);
    }

    // 기존 자동 생성된 저점 채널 제거
    const filteredDrawings = state.drawings.filter(d => {
      // 저점 채널 추세선 제거
      if (d.id.startsWith('auto-trendline-low-')) {
        return false;
      }
      // 저점 채널 평행선 제거
      if (d.id.startsWith('auto-parallel-low-')) {
        return false;
      }
      return true;
    });

    const result = {
      drawings: [...filteredDrawings, ...newDrawings],
    };

    // 진입점 계산 및 패턴 분류
    setTimeout(() => {
      get().calculateLowChannelEntryPoints();
      get().classifyChannelPattern();
    }, 0);

    return result;
  }),

  calculateHighChannelEntryPoints: () => {
    const state = get();
    const { candlestickData, drawings } = state;

    if (candlestickData.length === 0) {
      return;
    }

    // 현재 캔들 시간
    const currentTime = candlestickData[candlestickData.length - 1].time;

    // 고점 채널 Drawing 찾기
    const upperLine = drawings.find(d => d.id.startsWith('auto-trendline-') && !d.id.includes('low'));
    const lowerLine = drawings.find(d => d.id.startsWith('auto-parallel-') && !d.id.includes('low'));

    if (!upperLine || !lowerLine) {
      // 고점 채널이 없거나 불완전함
      set({
        highChannelEntryPoints: {
          shortEntry: null,
          longEntry: null,
        }
      });
      return;
    }

    // 각 선의 두 점을 사용하여 직선 방정식 구하기
    const calcPriceAtTime = (line: Drawing, time: number): number => {
      const p1 = line.points[0];
      const p2 = line.points[1];

      const slope = (p2.price - p1.price) / (p2.time - p1.time);
      return p1.price + slope * (time - p1.time);
    };

    const shortEntry = calcPriceAtTime(upperLine, currentTime);
    const longEntry = calcPriceAtTime(lowerLine, currentTime);

    console.log('High channel entry points:', { shortEntry, longEntry, currentTime });

    set({
      highChannelEntryPoints: {
        shortEntry,
        longEntry,
      }
    });
  },

  calculateLowChannelEntryPoints: () => {
    const state = get();
    const { candlestickData, drawings } = state;

    if (candlestickData.length === 0) {
      return;
    }

    // 현재 캔들 시간
    const currentTime = candlestickData[candlestickData.length - 1].time;

    // 저점 채널 Drawing 찾기
    const lowerLine = drawings.find(d => d.id.startsWith('auto-trendline-low-'));
    const upperLine = drawings.find(d => d.id.startsWith('auto-parallel-low-'));

    if (!lowerLine || !upperLine) {
      // 저점 채널이 없거나 불완전함
      set({
        lowChannelEntryPoints: {
          shortEntry: null,
          longEntry: null,
        }
      });
      return;
    }

    // 각 선의 두 점을 사용하여 직선 방정식 구하기
    const calcPriceAtTime = (line: Drawing, time: number): number => {
      const p1 = line.points[0];
      const p2 = line.points[1];

      const slope = (p2.price - p1.price) / (p2.time - p1.time);
      return p1.price + slope * (time - p1.time);
    };

    // 저점 채널의 경우:
    // - 하단선(저점 연결선)에서 롱 진입
    // - 상단선(평행선)에서 숏 진입
    const longEntry = calcPriceAtTime(lowerLine, currentTime);
    const shortEntry = calcPriceAtTime(upperLine, currentTime);

    console.log('Low channel entry points:', { shortEntry, longEntry, currentTime });

    set({
      lowChannelEntryPoints: {
        shortEntry,
        longEntry,
      }
    });
  },

  classifyChannelPattern: () => {
    const state = get();
    const { candlestickData, drawings } = state;

    // 채널 확인
    const highUpper = drawings.find(d => d.id.startsWith('auto-trendline-') && !d.id.includes('low'));
    const lowLower = drawings.find(d => d.id.startsWith('auto-trendline-low-'));

    // 채널이 하나도 없거나 데이터가 부족하면 패턴 없음
    if ((!highUpper && !lowLower) || candlestickData.length < 200) {
      set({ channelPattern: 'none' });
      return;
    }

    // 장기 이동평균선 계산 (200일)
    const ma200Period = 200;
    let ma200 = 0;

    if (candlestickData.length >= ma200Period) {
      let sum = 0;
      for (let i = candlestickData.length - ma200Period; i < candlestickData.length; i++) {
        sum += candlestickData[i].close;
      }
      ma200 = sum / ma200Period;
    } else {
      // 데이터가 부족하면 전체 평균 사용
      let sum = 0;
      for (const candle of candlestickData) {
        sum += candle.close;
      }
      ma200 = sum / candlestickData.length;
    }

    // 현재 가격
    const currentPrice = candlestickData[candlestickData.length - 1].close;

    // 고점 채널만 사용 (이평선 위/아래 관계없이)
    // - 이평선 위: ATH + 왼쪽 고점 연결
    // - 이평선 아래: 기존 알고리즘 (15일 고점)
    const pattern: ChannelPattern = 'descending';

    console.log('Channel pattern classified (MA200 based):', {
      pattern,
      currentPrice,
      ma200,
      priceAboveMA: currentPrice > ma200,
      strategy: currentPrice > ma200 ? 'ATH + 왼쪽 고점' : '기존 알고리즘',
    });

    set({
      channelPattern: pattern
    });

    // 패턴 분류 후 추천 진입점 계산
    setTimeout(() => {
      get().calculateRecommendedEntries();
    }, 0);
  },

  calculateRecommendedEntries: () => {
    const state = get();
    const { channelPattern, highChannelEntryPoints, lowChannelEntryPoints } = state;

    const recommended: RecommendedEntry[] = [];

    // 이평선 기반 단순화된 전략
    if (channelPattern === 'ascending') {
      // 상승 추세 (가격 > MA200) → 저점 채널 사용
      if (lowChannelEntryPoints.longEntry !== null) {
        recommended.push({
          price: lowChannelEntryPoints.longEntry,
          type: 'long',
          channel: 'low',
          priority: 'primary',
        });
      }
      if (lowChannelEntryPoints.shortEntry !== null) {
        recommended.push({
          price: lowChannelEntryPoints.shortEntry,
          type: 'short',
          channel: 'low',
          priority: 'secondary',
        });
      }
    } else if (channelPattern === 'descending') {
      // 하락 추세 (가격 < MA200) → 고점 채널 사용
      if (highChannelEntryPoints.shortEntry !== null) {
        recommended.push({
          price: highChannelEntryPoints.shortEntry,
          type: 'short',
          channel: 'high',
          priority: 'primary',
        });
      }
      if (highChannelEntryPoints.longEntry !== null) {
        recommended.push({
          price: highChannelEntryPoints.longEntry,
          type: 'long',
          channel: 'high',
          priority: 'secondary',
        });
      }
    }

    console.log('Recommended entries (MA200 based):', recommended);
    set({ recommendedEntries: recommended });
  },

  checkChannelBreakout: () => {
    const state = get();
    const { candlestickData, highChannelEntryPoints } = state;

    if (candlestickData.length === 0) {
      return;
    }

    // 고점 채널만 사용하므로 highChannelEntryPoints만 확인
    if (highChannelEntryPoints.shortEntry === null || highChannelEntryPoints.longEntry === null) {
      return;
    }

    const currentPrice = candlestickData[candlestickData.length - 1].close;
    const upperPrice = highChannelEntryPoints.shortEntry;
    const lowerPrice = highChannelEntryPoints.longEntry;

    let breakoutStatus: 'upper' | 'lower' | null = null;

    // 상단 채널 돌파 확인 (현재가가 상단선 위)
    if (currentPrice > upperPrice) {
      breakoutStatus = 'upper';
      console.log('⚠️ 채널 상단 돌파 감지:', {
        currentPrice,
        upperPrice,
        diff: currentPrice - upperPrice,
      });
    }
    // 하단 채널 돌파 확인 (현재가가 하단선 아래)
    else if (currentPrice < lowerPrice) {
      breakoutStatus = 'lower';
      console.log('⚠️ 채널 하단 돌파 감지:', {
        currentPrice,
        lowerPrice,
        diff: lowerPrice - currentPrice,
      });
    }

    // 돌파 상태가 변경된 경우에만 업데이트
    if (breakoutStatus !== state.channelBreakout) {
      set({ channelBreakout: breakoutStatus });
      if (breakoutStatus) {
        console.log('🚫 채널 돌파로 인해 자동 거래 중지 (채널 재설정 필요)');
      } else {
        console.log('✅ 채널 내부로 복귀');
      }
    }
  },

  // 백테스팅 액션
  startBacktesting: () => {
    const state = get();

    console.log('백테스팅 모드 시작');

    // 현재 데이터를 스냅샷으로 저장
    set({
      isBacktesting: true,
      fullCandlestickData: [...state.candlestickData],
      fullVolumeData: [...state.volumeData],
      backtestingIndex: state.candlestickData.length - 1, // 마지막 캔들부터 시작
    });
  },

  stopBacktesting: () => {
    const state = get();

    console.log('백테스팅 모드 종료');

    // 전체 데이터로 복원
    set({
      isBacktesting: false,
      candlestickData: [...state.fullCandlestickData],
      volumeData: [...state.fullVolumeData],
      backtestingIndex: 0,
    });

    // 채널 재계산
    setTimeout(() => {
      get().recalculateChannels();
    }, 100);
  },

  setBacktestingIndex: (index: number) => {
    const state = get();

    if (!state.isBacktesting) {
      console.warn('백테스팅 모드가 아닙니다.');
      return;
    }

    // 인덱스 범위 체크
    const maxIndex = state.fullCandlestickData.length - 1;
    const clampedIndex = Math.max(50, Math.min(index, maxIndex)); // 최소 50개 캔들은 보여줌

    console.log(`백테스팅 시점 이동: ${clampedIndex + 1} / ${state.fullCandlestickData.length}`);

    // 해당 인덱스까지의 데이터만 표시
    const slicedData = state.fullCandlestickData.slice(0, clampedIndex + 1);
    const ma200Data = calculateMA200(slicedData);
    set({
      backtestingIndex: clampedIndex,
      candlestickData: slicedData,
      volumeData: state.fullVolumeData.slice(0, clampedIndex + 1),
      ma200Data,
      drawings: [], // 드로잉 초기화
    });

    // 채널 재계산
    setTimeout(() => {
      get().recalculateChannels();
      // 채널 재계산 후 돌파 상태 확인
      setTimeout(() => {
        get().checkChannelBreakout();
      }, 100);
    }, 50);
  },

  recalculateChannels: () => {
    console.log('채널 재계산 중...');

    const state = get();
    if (state.candlestickData.length < 50) {
      console.warn('데이터가 부족합니다.');
      return;
    }

    // 기존 자동 채널 드로잉 제거
    const manualDrawings = state.drawings.filter(d =>
      !d.id.startsWith('auto-trendline') &&
      !d.id.startsWith('auto-parallel')
    );

    set({ drawings: manualDrawings });

    // MA200 계산 및 패턴 판단 후 해당 채널만 생성
    setTimeout(() => {
      const { candlestickData } = get();

      // MA200 계산
      const ma200Period = 200;
      let ma200 = 0;

      if (candlestickData.length >= ma200Period) {
        let sum = 0;
        for (let i = candlestickData.length - ma200Period; i < candlestickData.length; i++) {
          sum += candlestickData[i].close;
        }
        ma200 = sum / ma200Period;
      } else if (candlestickData.length > 0) {
        let sum = 0;
        for (const candle of candlestickData) {
          sum += candle.close;
        }
        ma200 = sum / candlestickData.length;
      }

      const currentPrice = candlestickData[candlestickData.length - 1].close;

      console.log('백테스팅 MA200 기반 패턴 판단:', {
        currentPrice,
        ma200,
        pattern: currentPrice > ma200 ? 'ascending' : 'descending'
      });

      // 이평선 위/아래 관계없이 항상 고점 채널 생성
      // - 이평선 위: ATH + 왼쪽 고점 연결 → 최저점 평행이동
      // - 이평선 아래: 기존 알고리즘 (15일 고점 연결)
      console.log('백테스팅: 고점 채널 생성 (이평선:', currentPrice > ma200 ? '위' : '아래', ')');
      get().connectMajorPeaks();
    }, 100);
  },
}));
