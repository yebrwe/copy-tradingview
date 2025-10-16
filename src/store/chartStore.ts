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
}

export const useChartStore = create<ChartState>((set, get) => ({
  // 초기 상태
  candlestickData: [],
  volumeData: [],
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

    // 고점 채널의 평행이동 거리를 계산
    const peaks = findMajorPeaks(state.candlestickData);
    const allTimeLow = findAllTimeLow(state.candlestickData);

    if (peaks.length >= 2 && allTimeLow && sortedLows.length >= 2) {
      const sortedPeaks = sortPeaksByTime(peaks);
      const peak1 = sortedPeaks[0];
      const peak2 = sortedPeaks[1];

      // 고점 추세선의 기울기
      const peakSlope = (peak2.price - peak1.price) / (peak2.time - peak1.time);

      // 최저점 시간에서의 고점 선 가격
      const priceAtLowTime = peak1.price + peakSlope * (allTimeLow.time - peak1.time);

      // 고점 채널의 평행이동 거리 (절대값)
      const highChannelOffset = Math.abs(allTimeLow.price - priceAtLowTime);

      console.log('High channel offset:', highChannelOffset);

      // 저점 선을 같은 거리만큼 위로 평행이동
      const low1 = sortedLows[0];
      const low2 = sortedLows[1];

      const parallelPoint1 = {
        time: low1.time,
        price: low1.price + highChannelOffset,
      };

      const parallelPoint2 = {
        time: low2.time,
        price: low2.price + highChannelOffset,
      };

      const parallelLine: Drawing = {
        id: `auto-parallel-low-${Date.now()}`,
        type: 'trendline',
        points: [parallelPoint1, parallelPoint2],
        color: '#ef5350', // 저점 채널과 동일한 빨간색
        lineWidth: 1,
      };

      console.log('Parallel line created (same offset as high channel):', parallelLine);
      console.log('Vertical offset:', highChannelOffset);
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
    const { drawings } = state;

    // 고점 채널과 저점 채널 찾기
    const highUpper = drawings.find(d => d.id.startsWith('auto-trendline-') && !d.id.includes('low'));
    const highLower = drawings.find(d => d.id.startsWith('auto-parallel-') && !d.id.includes('low'));
    const lowLower = drawings.find(d => d.id.startsWith('auto-trendline-low-'));
    const lowUpper = drawings.find(d => d.id.startsWith('auto-parallel-low-'));

    // 채널이 없으면 패턴 없음
    if (!highUpper || !highLower || !lowLower || !lowUpper) {
      set({ channelPattern: 'none' });
      return;
    }

    // 기울기 계산 함수 (시간당 가격 변화율로 정규화)
    const calculateSlope = (line: Drawing): number => {
      const p1 = line.points[0];
      const p2 = line.points[1];
      const timeDiffHours = (p2.time - p1.time) / 3600; // 초를 시간으로 변환
      return (p2.price - p1.price) / timeDiffHours; // 시간당 가격 변화
    };

    const highChannelSlope = calculateSlope(highUpper);
    const lowChannelSlope = calculateSlope(lowLower);

    // 기울기 임계값 (시간당 가격 변화 기준)
    const avgPrice = (highUpper.points[0].price + lowLower.points[0].price) / 2;
    const flatThreshold = avgPrice * 0.0001; // 시간당 평균 가격의 0.01% 변화

    const isHighFlat = Math.abs(highChannelSlope) < flatThreshold;
    const isLowFlat = Math.abs(lowChannelSlope) < flatThreshold;
    const isHighRising = highChannelSlope > flatThreshold;
    const isHighFalling = highChannelSlope < -flatThreshold;
    const isLowRising = lowChannelSlope > flatThreshold;
    const isLowFalling = lowChannelSlope < -flatThreshold;

    let pattern: ChannelPattern = 'none';

    // 패턴 분류 로직 (리서치 기반)
    if (isLowRising && (isHighFlat || isHighRising)) {
      // 저점 상승 + 고점 평평/상승 = Ascending (상승 채널)
      pattern = 'ascending';
    } else if (isHighFalling && (isLowFlat || isLowFalling)) {
      // 고점 하락 + 저점 평평/하락 = Descending (하락 채널)
      pattern = 'descending';
    } else if (isHighFalling && isLowRising) {
      // 고점 하락 + 저점 상승 = Symmetrical (대칭 수렴)
      pattern = 'symmetrical';
    } else if (isHighFlat && isLowFlat) {
      // 고점 평평 + 저점 평평 = Ranging (횡보)
      pattern = 'ranging';
    }

    console.log('Channel pattern classified:', {
      pattern,
      highChannelSlope,
      lowChannelSlope,
      isHighFlat,
      isLowFlat,
      isHighRising,
      isHighFalling,
      isLowRising,
      isLowFalling,
    });

    set({ channelPattern: pattern });

    // 패턴 분류 후 추천 진입점 계산
    setTimeout(() => {
      get().calculateRecommendedEntries();
    }, 0);
  },

  calculateRecommendedEntries: () => {
    const state = get();
    const { channelPattern, highChannelEntryPoints, lowChannelEntryPoints } = state;

    const recommended: RecommendedEntry[] = [];

    // 패턴별 추천 전략
    switch (channelPattern) {
      case 'ascending':
        // 상승 채널: 저점채널 롱 (주), 고점채널 롱 (보조)
        if (lowChannelEntryPoints.longEntry !== null) {
          recommended.push({
            price: lowChannelEntryPoints.longEntry,
            type: 'long',
            channel: 'low',
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
        break;

      case 'descending':
        // 하락 채널: 고점채널 숏 (주), 저점채널 숏 (보조)
        if (highChannelEntryPoints.shortEntry !== null) {
          recommended.push({
            price: highChannelEntryPoints.shortEntry,
            type: 'short',
            channel: 'high',
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
        break;

      case 'symmetrical':
        // 대칭 수렴: 돌파 대기 - 진입점 추천하지 않음 (돌파 방향 불확실)
        // 추천 진입점 없음 (빈 배열)
        break;

      case 'ranging':
        // 횡보: 양방향 거래 - 고점채널 숏, 저점채널 롱
        if (highChannelEntryPoints.shortEntry !== null) {
          recommended.push({
            price: highChannelEntryPoints.shortEntry,
            type: 'short',
            channel: 'high',
            priority: 'primary',
          });
        }
        if (lowChannelEntryPoints.longEntry !== null) {
          recommended.push({
            price: lowChannelEntryPoints.longEntry,
            type: 'long',
            channel: 'low',
            priority: 'primary',
          });
        }
        break;

      default:
        // 패턴 없음: 고점채널 기본 전략
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
        break;
    }

    console.log('Recommended entries:', recommended);
    set({ recommendedEntries: recommended });
  },
}));
