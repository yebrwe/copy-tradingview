import { useEffect, useRef, useState } from 'react';
import { useChartStore } from '../../store/chartStore';
import type { Point, Drawing } from '../../types/trading.types';

interface DrawingLayerProps {
  chartWidth: number;
  chartHeight: number;
}

export const DrawingLayer = ({ chartWidth, chartHeight }: DrawingLayerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { selectedTool, drawings, addDrawing, candlestickData } = useChartStore();

  const [isDrawing, setIsDrawing] = useState(false);
  const [currentDrawing, setCurrentDrawing] = useState<Point[]>([]);

  // Time/Price를 픽셀 좌표로 변환하는 헬퍼 함수
  const convertToPixelCoordinates = (point: Point): { x: number; y: number } => {
    // 이미 픽셀 좌표가 있으면 그대로 사용
    if (point.x !== undefined && point.y !== undefined) {
      return { x: point.x, y: point.y };
    }

    // Time/Price로부터 픽셀 좌표 계산
    if (candlestickData.length === 0) {
      return { x: 0, y: 0 };
    }

    // 데이터 범위 계산
    const times = candlestickData.map(c => c.time);
    const prices = candlestickData.flatMap(c => [c.high, c.low]);

    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    // 여백 추가 (10%)
    const padding = 0.1;
    const priceRange = maxPrice - minPrice;
    const paddedMinPrice = minPrice - priceRange * padding;
    const paddedMaxPrice = maxPrice + priceRange * padding;

    // 선형 변환
    const x = ((point.time - minTime) / (maxTime - minTime)) * chartWidth;
    const y = chartHeight - ((point.price - paddedMinPrice) / (paddedMaxPrice - paddedMinPrice)) * chartHeight;

    return { x, y };
  };

  // Canvas에 그림 그리기
  const draw = (ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, chartWidth, chartHeight);

    // 디버깅: Canvas가 제대로 그려지는지 확인하기 위한 반투명 배경
    // ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
    // ctx.fillRect(0, 0, chartWidth, chartHeight);

    console.log('DrawingLayer: drawings count =', drawings.length);
    console.log('DrawingLayer: candlestickData count =', candlestickData.length);

    // 기존 그림들 렌더링
    drawings.forEach((drawing) => {
      console.log('Drawing:', drawing);
      drawShape(ctx, drawing);
    });

    // 현재 그리고 있는 도형
    if (isDrawing && currentDrawing.length > 0) {
      const tempDrawing: Drawing = {
        id: 'temp',
        type: selectedTool,
        points: currentDrawing,
        color: '#2196f3',
        lineWidth: 2,
      };
      drawShape(ctx, tempDrawing);
    }
  };

  // 도형 그리기
  const drawShape = (ctx: CanvasRenderingContext2D, drawing: Drawing) => {
    if (drawing.points.length === 0) return;

    ctx.strokeStyle = drawing.color;
    ctx.lineWidth = drawing.lineWidth;
    ctx.lineCap = 'round';

    switch (drawing.type) {
      case 'trendline':
        drawTrendline(ctx, drawing.points);
        break;
      case 'horizontal':
        drawHorizontalLine(ctx, drawing.points);
        break;
      case 'rectangle':
        drawRectangle(ctx, drawing.points);
        break;
      default:
        break;
    }
  };

  const drawTrendline = (ctx: CanvasRenderingContext2D, points: Point[]) => {
    if (points.length < 2) return;

    console.log('drawTrendline: points =', points);
    const p1 = convertToPixelCoordinates(points[0]);
    const p2 = convertToPixelCoordinates(points[1]);
    console.log('drawTrendline: pixel coordinates =', { p1, p2 });

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  };

  const drawHorizontalLine = (ctx: CanvasRenderingContext2D, points: Point[]) => {
    if (points.length === 0) return;

    const y = points[0].y || 0;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(chartWidth, y);
    ctx.stroke();
  };

  const drawRectangle = (ctx: CanvasRenderingContext2D, points: Point[]) => {
    if (points.length < 2) return;

    const x1 = points[0].x || 0;
    const y1 = points[0].y || 0;
    const x2 = points[1].x || 0;
    const y2 = points[1].y || 0;

    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
  };

  // 마우스 이벤트 핸들러
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (selectedTool === 'none') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);
    setCurrentDrawing([{ time: 0, price: 0, x, y }]);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || selectedTool === 'none') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setCurrentDrawing((prev) => {
      if (prev.length === 1) {
        return [...prev, { time: 0, price: 0, x, y }];
      } else {
        return [prev[0], { time: 0, price: 0, x, y }];
      }
    });
  };

  const handleMouseUp = () => {
    if (isDrawing && currentDrawing.length >= 2) {
      const newDrawing: Drawing = {
        id: `drawing-${Date.now()}`,
        type: selectedTool,
        points: currentDrawing,
        color: '#2196f3',
        lineWidth: 2,
      };

      addDrawing(newDrawing);
    }

    setIsDrawing(false);
    setCurrentDrawing([]);
  };

  // Canvas 다시 그리기
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    draw(ctx);
  }, [drawings, currentDrawing, isDrawing, chartWidth, chartHeight]);

  return (
    <canvas
      ref={canvasRef}
      width={chartWidth}
      height={chartHeight}
      className="absolute top-0 left-0 cursor-crosshair pointer-events-auto"
      style={{ zIndex: 10 }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    />
  );
};
