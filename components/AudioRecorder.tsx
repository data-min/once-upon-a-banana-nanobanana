import React, { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext';
import { useMediaRecorder, useSpeechRecognition } from '../utils/useMediaRecorder';
import { generateCoverAndFirstPage, generateNextPage, revisePage } from '../services/geminiService';
import Button from './Button';
import { CaptureData } from '../types';

const AudioRecorder: React.FC = () => {
  const { state, dispatch } = useContext(AppContext);
  const { captureContext } = state;
  const { status, startRecording, stopRecording, getMediaBlob, timer, error } = useMediaRecorder({ isVideo: false, timeLimit: 30 });
  const { transcript, isListening, startListening, stopListening, supported: speechSupported, error: speechError } = useSpeechRecognition();
  const [textPrompt, setTextPrompt] = useState('');

  const handleStart = () => {
    startRecording();
    if (speechSupported) startListening();
  };

  const handleStop = () => {
    stopRecording();
    if (speechSupported) stopListening();
  };
  
  const handleCancel = () => {
    dispatch({ type: 'CANCEL_REAL_TIME_INPUT' });
  };

  const handleConfirm = async () => {
    if (!textPrompt) {
      alert("Please add a text description for your narration!");
      return;
    }
     if (!transcript && !textPrompt) {
      dispatch({ type: 'GENERATION_FAILURE', payload: "No speech or text was provided. Please try again." });
      return;
    }
    
    // For audio, the transcript is the main payload. The image part is just a placeholder.
    const placeholderBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

    const captureData: CaptureData = {
      type: 'audio',
      base64: placeholderBase64,
      mimeType: 'image/png',
      transcript,
      text: textPrompt,
    };

    dispatch({ type: 'START_GENERATION', payload: 'Turning your words into a story...' });

    try {
      if (captureContext.from === 'input') {
        // FIX: Added the onProgress callback argument, which is required by the function signature.
        const { title, subtitle, characters, coverImageUrl, firstPage } = await generateCoverAndFirstPage({ capture: captureData }, state.age, state.style, () => {});
        dispatch({ type: 'GENERATION_SUCCESS', payload: { title, subtitle, characters, coverImageUrl, firstPage } });
      } else if (captureContext.from === 'creating' && captureContext.pageId) { // Revision
        if (!state.book) throw new Error("Book not found for revision");
        const page = state.book.pages.find(p => p.id === captureContext.pageId);
        if (!page) throw new Error("Page not found for revision");
        const { newRevision } = await revisePage(page, captureData, state.age, state.style, 'text', state.book.characters);
        dispatch({ type: 'REVISION_SUCCESS', payload: { pageId: page.id, newRevision } });
      } else { // New Page
        if (!state.book) throw new Error("Book not found for new page");
        const newPage = await generateNextPage(state.book, { capture: captureData }, state.age, state.style);
        dispatch({ type: 'ADD_PAGE_SUCCESS', payload: newPage });
      }
    } catch (err) {
      dispatch({ type: 'GENERATION_FAILURE', payload: err instanceof Error ? err.message : "Failed to generate from audio" });
    }
  };

  return (
    <div className="w-full flex flex-col items-center animate-fade-in">
      <h2 className="font-display text-5xl text-orange-500 mb-4">Tell & Describe Your Idea!</h2>
      <div className="w-full max-w-xl bg-white/70 p-6 rounded-2xl shadow-lg text-center">
        <div className="my-8">
            <div className={`mx-auto w-24 h-24 rounded-full flex items-center justify-center transition-all ${isListening ? 'bg-red-500 animate-pulse' : 'bg-cyan-400'}`}>
                <span className="text-5xl">🎙️</span>
            </div>
            {status === 'recording' && <p className="font-display text-4xl mt-4">{timer}s</p>}
        </div>
        
        {error && <p className="text-red-500 mt-2">{error}</p>}
        {speechError && <p className="text-red-500 mt-2 font-body">{speechError}</p>}
        {!speechSupported && <p className="text-red-500 mt-2">Speech recognition is not supported on this browser. Try Chrome.</p>}
        
        <div className="min-h-[6rem] mt-4 p-4 bg-amber-100/50 rounded-lg">
            <p className="font-body text-gray-700 italic">{transcript || (isListening ? "Listening..." : "Your spoken words will appear here.")}</p>
        </div>
        {status === 'stopped' && getMediaBlob() && <audio src={URL.createObjectURL(getMediaBlob()!)} controls className="w-full mt-4"></audio>}
        
        <textarea 
            value={textPrompt}
            onChange={e => setTextPrompt(e.target.value)}
            placeholder="Add a written description here..."
            className="w-full p-4 mt-4 font-body text-lg border-2 border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-400 focus:outline-none"
            rows={2}
        />
      </div>

      <div className="flex gap-4 mt-6">
        <Button onClick={handleCancel} variant="secondary">Cancel</Button>
        {status !== 'recording' && status !== 'stopped' && <Button onClick={handleStart} disabled={!speechSupported}>Start Speaking</Button>}
        {status === 'recording' && <Button onClick={handleStop} className="bg-red-500 hover:bg-red-600">Stop</Button>}
        {status === 'stopped' && <Button onClick={handleConfirm} disabled={!textPrompt && !transcript}>Use This Narration</Button>}
      </div>
    </div>
  );
};

export default AudioRecorder;