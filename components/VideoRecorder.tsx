import React, { useContext, useState, useRef, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { useMediaRecorder, useSpeechRecognition } from '../utils/useMediaRecorder';
import { generateNextPage, revisePage } from '../services/geminiService';
import Button from './Button';
import { CaptureData, MediaAttachment } from '../types';
import { fileToBase64 } from '../utils/fileUtils';

const VideoRecorder: React.FC = () => {
  const { state, dispatch } = useContext(AppContext);
  const { captureContext } = state;
  const { status, startRecording, stopRecording, getMediaBlob, error, stream } = useMediaRecorder({ isVideo: true });
  const { transcript, isListening, startListening, stopListening, supported: speechSupported, error: speechError } = useSpeechRecognition();
  const [textPrompt, setTextPrompt] = useState('');
  
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

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
        alert("Please add a text description for your video!");
        return;
    }
    const videoBlob = getMediaBlob();
    if (!videoBlob || !captureContext) return;
    
    const videoElement = document.createElement('video');
    videoElement.src = URL.createObjectURL(videoBlob);
    
    videoElement.onloadeddata = () => {
      videoElement.currentTime = 1; // Capture frame at 1 second
    };

    videoElement.onseeked = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        const frameDataUrl = canvas.toDataURL('image/jpeg');
        const [, frameBase64] = frameDataUrl.split(',');

        try {
            if (captureContext.from === 'input') {
                // FIX: The fileToBase64 utility expects a File object, not a Blob. Convert the Blob to a File before passing it.
                const videoFile = new File([videoBlob], "recorded-video.webm", { type: videoBlob.type });
                const { base64: fullVideoBase64, mimeType: fullVideoMimeType } = await fileToBase64(videoFile);
                const mediaAttachment: MediaAttachment = {
                    id: new Date().toISOString(),
                    type: 'video',
                    source: 'recording',
                    base64: fullVideoBase64,
                    mimeType: fullVideoMimeType,
                    previewDataUrl: URL.createObjectURL(videoBlob),
                    transcript,
                };
                dispatch({ type: 'ADD_MEDIA_TO_INITIAL_IDEA', payload: mediaAttachment });
                dispatch({ type: 'SET_STEP', payload: 'input' });
            } else {
                 dispatch({ type: 'START_GENERATION', payload: 'Interpreting your performance...' });
                const captureData: CaptureData = {
                    type: 'video',
                    base64: frameBase64,
                    mimeType: 'image/jpeg',
                    transcript,
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
                    const newPage = await generateNextPage(state.book, { text: textPrompt, media:[], capture: captureData }, state.age, state.style);
                    dispatch({ type: 'ADD_PAGE_SUCCESS', payload: newPage });
                }
            }
        } catch (err) {
            dispatch({ type: 'GENERATION_FAILURE', payload: err instanceof Error ? err.message : "Failed to generate from video" });
        }
    };
  };

  return (
    <div className="w-full flex flex-col items-center animate-fade-in">
      <h2 className="font-display text-5xl text-orange-500 mb-4">Record & Describe Your Idea!</h2>
      <div className="w-full max-w-xl bg-white/70 p-6 rounded-2xl shadow-lg">
        <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
          {status !== 'stopped' && <video ref={videoRef} autoPlay muted className="w-full h-full object-cover"></video>}
          {status === 'recording' && (
            <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-500 text-white font-body px-3 py-1 rounded-full animate-pulse z-10">
                <div className="w-2 h-2 bg-white rounded-full"></div>
                <span>REC</span>
            </div>
          )}
          {status === 'stopped' && getMediaBlob() && <video src={URL.createObjectURL(getMediaBlob()!)} controls className="w-full h-full"></video>}
        </div>
        {error && <p className="text-red-500 mt-2">{error}</p>}
        {speechError && <p className="text-red-500 mt-2 font-body">{speechError}</p>}
        {isListening && <p className="text-sm text-gray-600 mt-2">Listening for narration...</p>}
        {status === 'stopped' && transcript && <div className="mt-4 p-2 bg-amber-100/50 rounded-lg"><p className="font-body text-gray-700 italic">Heard: "{transcript}"</p></div>}
        
        <textarea 
          value={textPrompt}
          onChange={e => setTextPrompt(e.target.value)}
          placeholder="Describe what's happening or what the story should be about..."
          className="w-full h-24 p-2 mt-4 font-body text-lg border-2 border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-400 focus:outline-none"
          rows={3}
        />
      </div>

      <div className="flex gap-4 mt-6">
        <Button onClick={handleCancel} variant="secondary">Cancel</Button>
        {status !== 'recording' && status !== 'stopped' && <Button onClick={handleStart}>Start Recording</Button>}
        {status === 'recording' && <Button onClick={handleStop} className="bg-red-500 hover:bg-red-600">Stop</Button>}
        {status === 'stopped' && <Button onClick={handleConfirm} disabled={!textPrompt}>Use This Video</Button>}
      </div>
    </div>
  );
};

export default VideoRecorder;
