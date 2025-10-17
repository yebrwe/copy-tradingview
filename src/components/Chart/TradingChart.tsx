import { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import { useChartStore } from '../../store/chartStore';
import type { Drawing } from '../../types/trading.types';

const CHART_RANGE_STORAGE_KEY = 'trading_chart_visible_range';

export const TradingChart = () => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const ma200SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isRestoringRange = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const animationTimeRef = useRef(0);

  const { candlestickData, ma200Data, drawings, highChannelEntryPoints, lowChannelEntryPoints, recommendedEntries, channelPattern } = useChartStore();

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // 차트 생성
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 600,
      layout: {
        background: { color: '#131722' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#1e222d' },
        horzLines: { color: '#1e222d' },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: '#2b2b43',
      },
      timeScale: {
        borderColor: '#2b2b43',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // 캔들스틱 시리즈 추가
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    candlestickSeriesRef.current = candlestickSeries;

    // MA200 라인 시리즈 추가
    const ma200Series = chart.addLineSeries({
      color: '#ffa500', // 주황색
      lineWidth: 2,
      title: 'MA200',
      priceLineVisible: false,
      lastValueVisible: true,
    });

    ma200SeriesRef.current = ma200Series;

    // 차트 범위 변경 시 localStorage에 저장
    const saveVisibleRange = () => {
      if (isRestoringRange.current) return; // 복원 중에는 저장하지 않음

      const logicalRange = chart.timeScale().getVisibleLogicalRange();
      if (logicalRange) {
        localStorage.setItem(CHART_RANGE_STORAGE_KEY, JSON.stringify(logicalRange));
      }
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(saveVisibleRange);

    // 반응형 처리
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(saveVisibleRange);
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // 캔들스틱 데이터 업데이트
  useEffect(() => {
    if (candlestickSeriesRef.current && candlestickData.length > 0) {
      candlestickSeriesRef.current.setData(candlestickData);

      // 데이터 로드 후 저장된 범위 복원
      if (chartRef.current) {
        const savedRange = localStorage.getItem(CHART_RANGE_STORAGE_KEY);
        if (savedRange) {
          try {
            const range = JSON.parse(savedRange);
            isRestoringRange.current = true;
            chartRef.current.timeScale().setVisibleLogicalRange(range);
            setTimeout(() => {
              isRestoringRange.current = false;
            }, 100);
          } catch (error) {
            // Silently handle errors
          }
        }
      }
    }
  }, [candlestickData]);

  // MA200 데이터 업데이트
  useEffect(() => {
    if (ma200SeriesRef.current && ma200Data.length > 0) {
      ma200SeriesRef.current.setData(ma200Data);
    }
  }, [ma200Data]);

  // Drawing 오버레이 그리기 (애니메이션 포함)
  useEffect(() => {
    if (!chartRef.current || !candlestickSeriesRef.current || !canvasRef.current) return;
    if (drawings.length === 0) return;

    const chart = chartRef.current;
    const series = candlestickSeriesRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawDrawings = () => {
      const chartWidth = chartContainerRef.current?.clientWidth || 0;
      const chartHeight = 600;

      // Canvas 크기 설정
      canvas.width = chartWidth;
      canvas.height = chartHeight;

      ctx.clearRect(0, 0, chartWidth, chartHeight);

      drawings.forEach((drawing, index) => {
        if (drawing.type === 'trendline' && drawing.points.length >= 2) {
          const p1 = drawing.points[0];
          const p2 = drawing.points[1];

          // Lightweight Charts API로 좌표 변환
          const x1 = chart.timeScale().timeToCoordinate(p1.time as any);
          const y1 = series.priceToCoordinate(p1.price);
          const x2 = chart.timeScale().timeToCoordinate(p2.time as any);
          const y2 = series.priceToCoordinate(p2.price);

          if (x1 === null || y1 === null || x2 === null || y2 === null) {
            return;
          }

          if (x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
            // 두 점 사이의 기울기 계산
            const slope = (y2 - y1) / (x2 - x1);

            // 캔버스 끝까지 선을 연장
            const chartWidth = chartContainerRef.current?.clientWidth || 0;

            // x = 0일 때의 y 좌표
            const y0 = y1 - slope * x1;

            // x = chartWidth일 때의 y 좌표
            const yMax = y1 + slope * (chartWidth - x1);

            ctx.strokeStyle = drawing.color;
            ctx.lineWidth = drawing.lineWidth;
            ctx.beginPath();
            ctx.moveTo(0, y0);
            ctx.lineTo(chartWidth, yMax);
            ctx.stroke();
          }
        }
      });

      // 진입점 마커 그리기 (현재 캔들의 X축 위치에서 각 채널과 만나는 지점)
      if (candlestickData.length > 0) {
        const currentTime = candlestickData[candlestickData.length - 1].time;
        const currentX = chart.timeScale().timeToCoordinate(currentTime as any);

        if (currentX !== null) {
          const markerSize = 8;

          // 추천 진입점 확인 헬퍼 함수
          const isRecommended = (price: number, type: 'long' | 'short', channel: 'high' | 'low'): boolean => {
            return recommendedEntries.some(
              entry => Math.abs(entry.price - price) < 0.01 && entry.type === type && entry.channel === channel
            );
          };

          // 깜빡이는 효과를 위한 opacity 계산 (0.5 ~ 1.0 사이에서 변화)
          const blinkOpacity = 0.5 + Math.abs(Math.sin(animationTimeRef.current * 0.003)) * 0.5;

          // 고점 채널 진입점 마커 (하락 추세일 때만 표시)
          if (channelPattern === 'descending' && highChannelEntryPoints.shortEntry !== null && highChannelEntryPoints.longEntry !== null) {
            const shortY = series.priceToCoordinate(highChannelEntryPoints.shortEntry);
            const longY = series.priceToCoordinate(highChannelEntryPoints.longEntry);

            if (shortY !== null && longY !== null) {
              // 숏 진입점 마커 (아래 방향 삼각형, 빨간색)
              const isShortRecommended = isRecommended(highChannelEntryPoints.shortEntry, 'short', 'high');
              ctx.globalAlpha = isShortRecommended ? blinkOpacity : 0.4;
              ctx.fillStyle = '#ef5350';
              ctx.beginPath();
              ctx.moveTo(currentX, shortY);
              ctx.lineTo(currentX - markerSize, shortY - markerSize * 1.5);
              ctx.lineTo(currentX + markerSize, shortY - markerSize * 1.5);
              ctx.closePath();
              ctx.fill();
              ctx.globalAlpha = 1.0;

              // 롱 진입점 마커 (위 방향 삼각형, 초록색)
              const isLongRecommended = isRecommended(highChannelEntryPoints.longEntry, 'long', 'high');
              ctx.globalAlpha = isLongRecommended ? blinkOpacity : 0.4;
              ctx.fillStyle = '#26a69a';
              ctx.beginPath();
              ctx.moveTo(currentX, longY);
              ctx.lineTo(currentX - markerSize, longY + markerSize * 1.5);
              ctx.lineTo(currentX + markerSize, longY + markerSize * 1.5);
              ctx.closePath();
              ctx.fill();
              ctx.globalAlpha = 1.0;
            }
          }

          // 저점 채널 진입점 마커 (상승 추세일 때만 표시)
          if (channelPattern === 'ascending' && lowChannelEntryPoints.shortEntry !== null && lowChannelEntryPoints.longEntry !== null) {
            const shortY = series.priceToCoordinate(lowChannelEntryPoints.shortEntry);
            const longY = series.priceToCoordinate(lowChannelEntryPoints.longEntry);

            if (shortY !== null && longY !== null) {
              // 숏 진입점 마커 (아래 방향 삼각형, 빨간색)
              const isShortRecommended = isRecommended(lowChannelEntryPoints.shortEntry, 'short', 'low');
              ctx.globalAlpha = isShortRecommended ? blinkOpacity : 0.4;
              ctx.fillStyle = '#ef5350';
              ctx.beginPath();
              ctx.moveTo(currentX, shortY);
              ctx.lineTo(currentX - markerSize, shortY - markerSize * 1.5);
              ctx.lineTo(currentX + markerSize, shortY - markerSize * 1.5);
              ctx.closePath();
              ctx.fill();
              ctx.globalAlpha = 1.0;

              // 롱 진입점 마커 (위 방향 삼각형, 초록색)
              const isLongRecommended = isRecommended(lowChannelEntryPoints.longEntry, 'long', 'low');
              ctx.globalAlpha = isLongRecommended ? blinkOpacity : 0.4;
              ctx.fillStyle = '#26a69a';
              ctx.beginPath();
              ctx.moveTo(currentX, longY);
              ctx.lineTo(currentX - markerSize, longY + markerSize * 1.5);
              ctx.lineTo(currentX + markerSize, longY + markerSize * 1.5);
              ctx.closePath();
              ctx.fill();
              ctx.globalAlpha = 1.0;
            }
          }
        }
      }
    };

    // 애니메이션 루프
    const animate = () => {
      animationTimeRef.current += 16; // ~60fps
      drawDrawings();
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    // 차트 스크롤/줌 시 다시 그리기
    const handleVisibleRangeChange = () => {
      drawDrawings();
    };

    chart.timeScale().subscribeVisibleTimeRangeChange(handleVisibleRangeChange);

    return () => {
      chart.timeScale().unsubscribeVisibleTimeRangeChange(handleVisibleRangeChange);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [drawings, candlestickData, highChannelEntryPoints, lowChannelEntryPoints, recommendedEntries, channelPattern]);

  return (
    <div className="relative w-full h-full">
      <div ref={chartContainerRef} className="w-full h-full" />
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 pointer-events-none"
        style={{ zIndex: 10 }}
      />
    </div>
  );
};
