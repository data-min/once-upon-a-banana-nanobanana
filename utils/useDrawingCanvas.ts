import { useState, useRef, useEffect } from 'react';

type Point = { x: number; y: number };
export type DrawingTool = 'brush' | 'eraser';
type Line = { points: Point[]; color: string; lineWidth: number; tool: DrawingTool };

export const useDrawingCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [undoStack, setUndoStack] = useState<Line[][]>([]);
  const [redoStack, setRedoStack] = useState<Line[][]>([]);
  
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(5);
  const [tool, setTool] = useState<DrawingTool>('brush');

  const getCanvasContext = () => {
    const canvas = canvasRef.current;
    return canvas ? canvas.getContext('2d') : null;
  };

  const redrawCanvas = (currentLines: Line[]) => {
    const ctx = getCanvasContext();
    if (!ctx || !canvasRef.current) return;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    // Ensure canvas background is white for snapshots
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    currentLines.forEach(({ points, color, lineWidth, tool }) => {
      ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      if (points.length > 0) {
        ctx.moveTo(points[0].x, points[0].y);
        points.forEach(point => ctx.lineTo(point.x, point.y));
        ctx.stroke();
      }
    });
    // Reset for next draw operation
    ctx.globalCompositeOperation = 'source-over';
  };

  useEffect(() => {
    redrawCanvas(lines);
  }, [lines]);

  const getPoint = (e: React.MouseEvent | React.TouchEvent): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX, clientY;
    if ('touches' in e) {
      const touch = e.touches[0];
      if (!touch) return null;
      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const point = getPoint(e);
    if (!point) return;
    setIsDrawing(true);
    setUndoStack(prev => [...prev, lines]);
    setRedoStack([]); // Clear redo stack on new action
    setLines(prev => [...prev, { points: [point], color, lineWidth, tool }]);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const point = getPoint(e);
    if (!point) return;
    setLines(prev => {
      const newLines = [...prev];
      if (newLines.length > 0) {
        const lastLine = newLines[newLines.length - 1];
        lastLine.points.push(point);
      }
      return newLines;
    });
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };
  
  const undo = () => {
    if (undoStack.length === 0) return;
    const lastState = undoStack[undoStack.length - 1];
    setRedoStack(prev => [lines, ...prev]);
    setLines(lastState);
    setUndoStack(prev => prev.slice(0, -1));
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[0];
    setUndoStack(prev => [...prev, lines]);
    setLines(nextState);
    setRedoStack(prev => prev.slice(1));
  };

  const clear = () => {
    setUndoStack(prev => [...prev, lines]);
    setLines([]);
    setRedoStack([]);
  };
  
  const getSnapshot = (type: 'image/png' | 'image/jpeg' = 'image/png', quality?: number): string => {
    const canvas = canvasRef.current;
    if (!canvas) return '';
    redrawCanvas(lines); // Ensure canvas is up-to-date before snapshot
    return canvas.toDataURL(type, quality);
  }

  return {
    canvasRef,
    startDrawing,
    draw,
    stopDrawing,
    undo,
    redo,
    clear,
    setColor,
    setLineWidth,
    setTool,
    color,
    lineWidth,
    tool,
    getSnapshot,
  };
};