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

interface ChartState {
  // 차트 데이터
  candlestickData: CandlestickData[];
  volumeData: VolumeData[];

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

  // 백테스팅 액션
  startBacktesting: () => void;
  stopBacktesting: () => void;
  setBacktestingIndex: (index: number) => void;
  recalculateChannels: () => void;
}

export const useChartStore = create<ChartState>((set, get) => ({
  // 초기 상태
  candlestickData: [],
  volumeData: [],
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

  // 액션들
  setCandlestickData: (data) => set({ candlestickData: data }),

  updateLastCandle: (candle) => set((state) => {
    const data = [...state.candlestickData];
    if (data.length > 0) {
      data[data.length - 1] = candle;
    }
    return { candlestickData: data };
  }),

  addCandle: (candle) => set((state) => ({
    candlestickData: [...state.candlestickData, candle]
  })),

  setVolumeData: (data) => set({ volumeData: data }),

  setTimeFrame: (timeFrame) => set({
    timeFrame,
    candlestickData: [], // 타임프레임 변경시 데이터 초기화
    volumeData: []
  }),

  setSelectedTool: (tool) => set({ selectedTool: tool }),

  addDrawing: (drawing) => set((state) => ({
    drawings: [...state.drawings, drawing]
  })),

  removeDrawing: (id) => set((state) => ({
    drawings: state.drawings.filter(d => d.id !== id)
  })),

  clearDrawings: () => set({ drawings: [] }),

  connectMajorPeaks: () => set((state) => {
    const peaks = findMajorPeaks(state.candlestickData);

    if (peaks.length < 2) {
      console.warn('Not enough peaks detected');
      return state;
    }

    // 시간 순으로 정렬
    const sortedPeaks = sortPeaksByTime(peaks);

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

    const newDrawings: Drawing[] = [trendline];

    // 평행선 생성 (금색 선을 최저점으로 평행이동)
    if (allTimeLow && sortedPeaks.length >= 2) {
      const peak1 = sortedPeaks[0];
      const peak2 = sortedPeaks[1];

      // 고점 추세선의 기울기 계산
      const priceSlope = (peak2.price - peak1.price) / (peak2.time - peak1.time);

      // 최저점 시간에서의 금색 선 가격 계산
      const priceAtLowTime = peak1.price + priceSlope * (allTimeLow.time - peak1.time);

      // 평행이동 거리 = 실제 최저점 가격 - 금색 선의 가격
      const verticalOffset = allTimeLow.price - priceAtLowTime;

      // 금색 선의 두 점을 수직으로 평행이동
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

      console.log('Parallel line created (vertical translation):', parallelLine);
      console.log('Vertical offset:', verticalOffset);
      newDrawings.push(parallelLine);
    }

    const result = {
      drawings: [...state.drawings, ...newDrawings],
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

    const result = {
      drawings: [...state.drawings, ...newDrawings],
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

    // 채널이 없으면 패턴 없음
    const highUpper = drawings.find(d => d.id.startsWith('auto-trendline-') && !d.id.includes('low'));
    const lowLower = drawings.find(d => d.id.startsWith('auto-trendline-low-'));

    if (!highUpper || !lowLower || candlestickData.length < 200) {
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

    // 이평선 기준 추세 판단
    let pattern: ChannelPattern = 'none';

    if (currentPrice > ma200) {
      // 현재 가격이 이평선 위 → 상승 추세 → 저점 채널 사용
      pattern = 'ascending';
    } else {
      // 현재 가격이 이평선 아래 → 하락 추세 → 고점 채널 사용
      pattern = 'descending';
    }

    console.log('Channel pattern classified (MA200 based):', {
      pattern,
      currentPrice,
      ma200,
      priceAboveMA: currentPrice > ma200,
    });

    // 조건에 맞는 채널만 표시
    let filteredDrawings = drawings;

    if (pattern === 'ascending') {
      // 상승 추세 → 저점 채널만 표시 (고점 채널 제거)
      filteredDrawings = drawings.filter(d =>
        !d.id.startsWith('auto-trendline-') || d.id.includes('low')
      ).filter(d =>
        !d.id.startsWith('auto-parallel-') || d.id.includes('low')
      );
      console.log('저점 채널만 표시 (상승 추세)');
    } else if (pattern === 'descending') {
      // 하락 추세 → 고점 채널만 표시 (저점 채널 제거)
      filteredDrawings = drawings.filter(d =>
        !d.id.startsWith('auto-trendline-low-')
      ).filter(d =>
        !d.id.startsWith('auto-parallel-low-')
      );
      console.log('고점 채널만 표시 (하락 추세)');
    }

    set({
      channelPattern: pattern,
      drawings: filteredDrawings
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
    set({
      backtestingIndex: clampedIndex,
      candlestickData: state.fullCandlestickData.slice(0, clampedIndex + 1),
      volumeData: state.fullVolumeData.slice(0, clampedIndex + 1),
      drawings: [], // 드로잉 초기화
    });

    // 채널 재계산
    setTimeout(() => {
      get().recalculateChannels();
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

    // 고점/저점 채널 자동 생성
    setTimeout(() => {
      get().connectMajorPeaks();
      setTimeout(() => {
        get().connectMajorLows();
      }, 100);
    }, 100);
  },
}));
