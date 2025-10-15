import { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import { useChartStore } from '../../store/chartStore';
import type { Drawing } from '../../types/trading.types';

export const TradingChart = () => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const { candlestickData, volumeData, drawings } = useChartStore();

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

    // 볼륨 시리즈 추가
    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
    });

    volumeSeriesRef.current = volumeSeries;
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

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
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // 캔들스틱 데이터 업데이트
  useEffect(() => {
    if (candlestickSeriesRef.current && candlestickData.length > 0) {
      candlestickSeriesRef.current.setData(candlestickData);
    }
  }, [candlestickData]);

  // 볼륨 데이터 업데이트
  useEffect(() => {
    if (volumeSeriesRef.current && volumeData.length > 0) {
      volumeSeriesRef.current.setData(volumeData);
    }
  }, [volumeData]);

  // Drawing 오버레이 그리기
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

      console.log('Drawing overlays, count:', drawings.length);

      drawings.forEach((drawing, index) => {
        console.log(`[Drawing ${index}] ID: ${drawing.id}, Type: ${drawing.type}, Color: ${drawing.color}, Points:`, drawing.points);

        if (drawing.type === 'trendline' && drawing.points.length >= 2) {
          const p1 = drawing.points[0];
          const p2 = drawing.points[1];

          // Lightweight Charts API로 좌표 변환
          const x1 = chart.timeScale().timeToCoordinate(p1.time as any);
          const y1 = series.priceToCoordinate(p1.price);
          const x2 = chart.timeScale().timeToCoordinate(p2.time as any);
          const y2 = series.priceToCoordinate(p2.price);

          console.log(`[Drawing ${index}] Trendline points:`, { p1, p2 });
          console.log(`[Drawing ${index}] Pixel coordinates:`, { x1, y1, x2, y2 });

          if (x1 === null || y1 === null || x2 === null || y2 === null) {
            console.warn(`[Drawing ${index}] Cannot draw: some coordinates are null`);
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

            console.log('Infinite line:', { slope, y0, yMax, chartWidth });

            ctx.strokeStyle = drawing.color;
            ctx.lineWidth = drawing.lineWidth;
            ctx.beginPath();
            ctx.moveTo(0, y0);
            ctx.lineTo(chartWidth, yMax);
            ctx.stroke();
          }
        }
      });
    };

    drawDrawings();

    // 차트 스크롤/줌 시 다시 그리기
    const handleVisibleRangeChange = () => {
      drawDrawings();
    };

    chart.timeScale().subscribeVisibleTimeRangeChange(handleVisibleRangeChange);

    return () => {
      chart.timeScale().unsubscribeVisibleTimeRangeChange(handleVisibleRangeChange);
    };
  }, [drawings, candlestickData]);

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
