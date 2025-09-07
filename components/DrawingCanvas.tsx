import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { useDrawingCanvas, DrawingTool } from '../utils/useDrawingCanvas';
import { generateNextPage, revisePage } from '../services/geminiService';
import Button from './Button';
import { CaptureData, MediaAttachment } from '../types';

const ToolButton: React.FC<{
    label: string;
    icon: string;
    isActive: boolean;
    onClick: () => void;
}> = ({ label, icon, isActive, onClick }) => (
    <button onClick={onClick} title={label} className={`w-16 h-16 flex items-center justify-center text-3xl rounded-xl shadow-md transition-transform transform ${isActive ? 'bg-orange-400 text-white scale-110' : 'bg-white hover:bg-orange-100'}`}>
        {icon}
    </button>
);


const DrawingCanvas: React.FC = () => {
  const { state, dispatch } = useContext(AppContext);
  const { captureContext } = state;
  const { canvasRef, startDrawing, draw, stopDrawing, undo, redo, clear, setColor, setLineWidth, setTool, color, lineWidth, tool, getSnapshot } = useDrawingCanvas();
  const [mimicStyle, setMimicStyle] = useState(false);
  const [textPrompt, setTextPrompt] = useState('');
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            if (e.shiftKey) {
                redo();
            } else {
                undo();
            }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const handleCancel = () => {
    dispatch({ type: 'CANCEL_REAL_TIME_INPUT' });
  };

  const handleConfirm = async () => {
    if (!textPrompt) {
        alert("Please describe your drawing in the text box!");
        return;
    }
    const snapshot = getSnapshot('image/png');
    if (!snapshot || !captureContext) return;
    const [, base64] = snapshot.split(',');

    try {
      if (captureContext.from === 'input') {
        const mediaAttachment: MediaAttachment = {
            id: new Date().toISOString(),
            type: 'image',
            source: 'drawing',
            base64,
            mimeType: 'image/png',
            previewDataUrl: snapshot,
            mimicStyle,
        };
        dispatch({ type: 'ADD_MEDIA_TO_INITIAL_IDEA', payload: mediaAttachment });
        dispatch({ type: 'SET_STEP', payload: 'input' });
      } else {
        dispatch({ type: 'START_GENERATION', payload: 'Bringing your drawing to life...' });
        const captureData: CaptureData = {
            type: 'drawing',
            base64,
            mimeType: 'image/png',
            mimicStyle,
            text: textPrompt,
        };
        if (captureContext.from === 'creating' && captureContext.pageId) { // Revision
            if (!state.book) throw new Error("Book not found for revision");
            const page = state.book.pages.find(p => p.id === captureContext.pageId);
            if (!page) throw new Error("Page not found for revision");
            const { newRevision } = await revisePage(page, captureData, state.age, state.style, 'text', state.book.characters);
            dispatch({ type: 'REVISION_SUCCESS', payload: { pageId: page.id, newRevision } });
        } else { // New Page
            if (!state.book) throw new Error("Book not found for new page");
            const newPage = await generateNextPage(state.book, { media:[], text: textPrompt, capture: captureData }, state.age, state.style);
            dispatch({ type: 'ADD_PAGE_SUCCESS', payload: newPage });
        }
      }
    } catch (err) {
      dispatch({ type: 'GENERATION_FAILURE', payload: err instanceof Error ? err.message : "Failed to generate from drawing" });
    }
  };

  return (
    <div className="w-full flex flex-col items-center animate-fade-in">
        <h2 className="font-display text-5xl text-orange-500 mb-4">Draw Your Idea & Describe It!</h2>
        <div className="w-full max-w-4xl flex flex-col lg:flex-row gap-4">
            <div className="flex flex-row lg:flex-col justify-center gap-4 bg-white/80 p-4 rounded-xl shadow-lg">
                <ToolButton label="Brush" icon="🖌️" isActive={tool === 'brush'} onClick={() => setTool('brush')} />
                <ToolButton label="Eraser" icon="🧼" isActive={tool === 'eraser'} onClick={() => setTool('eraser')} />
                <div className="flex flex-col items-center gap-2">
                    <label htmlFor="color-picker" title="Color" className="w-16 h-16 rounded-xl shadow-md cursor-pointer" style={{ backgroundColor: color, border: '2px solid rgba(0,0,0,0.1)' }}></label>
                    <input id="color-picker" type="color" value={color} onChange={e => setColor(e.target.value)} className="w-0 h-0 opacity-0" />
                    <span className="font-body text-xs">Color</span>
                </div>
                 <div className="flex flex-col items-center gap-2">
                    <input type="range" min="2" max="50" value={lineWidth} onChange={e => setLineWidth(Number(e.target.value))} className="w-16 accent-orange-500" title="Size"/>
                    <label className="font-body text-xs">Size</label>
                </div>
                <ToolButton label="Undo (Ctrl+Z)" icon="↩️" isActive={false} onClick={undo} />
                <ToolButton label="Redo (Ctrl+Shift+Z)" icon="↪️" isActive={false} onClick={redo} />
                <ToolButton label="Clear" icon="🗑️" isActive={false} onClick={clear} />
            </div>
            <div className="flex-grow flex flex-col gap-4">
                <canvas
                    ref={canvasRef}
                    width={800}
                    height={600}
                    className="bg-white rounded-xl shadow-lg cursor-crosshair w-full h-auto"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                />
                <textarea 
                    value={textPrompt}
                    onChange={e => setTextPrompt(e.target.value)}
                    placeholder="Describe your drawing here (e.g., 'A happy cat flying in space')..."
                    className="w-full p-4 font-body text-lg border-2 border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-400 focus:outline-none"
                    rows={2}
                />
            </div>
        </div>
         <div className="my-4 bg-white/70 p-4 rounded-xl shadow-lg flex items-center gap-4">
             <label className="font-body flex items-center gap-2 cursor-pointer">
                 <input type="checkbox" checked={mimicStyle} onChange={e => setMimicStyle(e.target.checked)} className="w-5 h-5 accent-orange-500"/>
                 Mimic my drawing style
             </label>
        </div>
        <div className="flex gap-4 mt-4">
            <Button onClick={handleCancel} variant="secondary">Cancel</Button>
            <Button onClick={handleConfirm} disabled={!textPrompt}>Confirm & Create</Button>
        </div>
    </div>
  );
};

export default DrawingCanvas;