import { create } from 'zustand';
import type {
  CandlestickData,
  VolumeData,
  TimeFrame,
  DrawingTool,
  Drawing
} from '../types/trading.types';
import { findMajorPeaks, sortPeaksByTime, findAllTimeLow } from '../utils/peakDetection';

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
}

export const useChartStore = create<ChartState>((set) => ({
  // 초기 상태
  candlestickData: [],
  volumeData: [],
  symbol: 'ETHUSDT',
  timeFrame: '1h', // 1시간봉으로 기본값 설정
  selectedTool: 'none',
  drawings: [],

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
      color: '#FFD700', // 금색으로 강조
      lineWidth: 2,
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
        color: '#00CED1', // 청록색으로 구분
        lineWidth: 2,
      };

      console.log('Parallel line created (vertical translation):', parallelLine);
      console.log('Vertical offset:', verticalOffset);
      newDrawings.push(parallelLine);
    }

    return {
      drawings: [...state.drawings, ...newDrawings],
    };
  }),
}));
