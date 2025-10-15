import { useEffect, useRef, useState } from 'react';
import { useChartStore } from '../../store/chartStore';
import type { Point, Drawing } from '../../types/trading.types';

interface DrawingLayerProps {
  chartWidth: number;
  chartHeight: number;
}

export const DrawingLayer = ({ chartWidth, chartHeight }: DrawingLayerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { selectedTool, drawings, addDrawing } = useChartStore();

  const [isDrawing, setIsDrawing] = useState(false);
  const [currentDrawing, setCurrentDrawing] = useState<Point[]>([]);

  // Canvas에 그림 그리기
  const draw = (ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, chartWidth, chartHeight);

    // 기존 그림들 렌더링
    drawings.forEach((drawing) => {
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

    ctx.beginPath();
    ctx.moveTo(points[0].x || 0, points[0].y || 0);
    ctx.lineTo(points[1].x || 0, points[1].y || 0);
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
      className="absolute top-0 left-0 cursor-crosshair"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    />
  );
};
