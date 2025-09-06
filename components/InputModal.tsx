import React, { useState, useContext, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { InitialIdea, CaptureType } from '../types';
import Button from './Button';
import { fileToBase64 } from '../utils/fileUtils';

const InputModal: React.FC = () => {
  const { dispatch } = useContext(AppContext);
  const [text, setText] = useState('');
  const [image, setImage] = useState<{ file: File; preview: string } | null>(null);
  const [video, setVideo] = useState<{ file: File; preview: string } | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage({
        file,
        preview: URL.createObjectURL(file),
      });
    }
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setVideo({
        file,
        preview: URL.createObjectURL(file),
      });
    }
  };

  const handleSubmit = async () => {
    let idea: InitialIdea = { text };
    if (image) {
      const { base64, mimeType } = await fileToBase64(image.file);
      idea.imageBase64 = base64;
      idea.imageMimeType = mimeType;
    }
    if (video) {
        const { base64, mimeType } = await fileToBase64(video.file);
        idea.videoBase64 = base64;
        idea.videoMimeType = mimeType;
    }
    dispatch({ type: 'SET_INITIAL_IDEA', payload: idea });
    dispatch({ type: 'SET_STEP', payload: 'style' });
  };
  
  const handleSelectRealTimeInput = (mode: CaptureType) => {
    dispatch({ type: 'START_REAL_TIME_INPUT', payload: { mode, from: 'input' } });
  };

  return (
    <div className="text-center animate-fade-in flex flex-col items-center justify-center min-h-[80vh]">
       <div className="absolute top-[-1rem] left-0">
        <button onClick={() => dispatch({ type: 'SET_STEP', payload: 'author' })} className="font-body text-gray-500 hover:text-gray-800 transition p-4">&larr; Back</button>
      </div>
      <h2 className="font-display text-5xl md:text-7xl text-orange-500 mb-8">Give us your idea — any way you like!</h2>
      
      <div className="w-full max-w-2xl bg-white/70 p-8 rounded-2xl shadow-lg backdrop-blur-sm">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g., A friendly dragon who is afraid of heights..."
          className="w-full h-32 p-4 font-body text-lg border-2 border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-400 focus:outline-none"
        />
        
        <div className="flex items-center justify-center gap-4 mt-6">
          <input type="file" accept="image/*" onChange={handleImageChange} ref={imageInputRef} className="hidden" />
          <input type="file" accept="video/*" onChange={handleVideoChange} ref={videoInputRef} className="hidden" />
          <button onClick={() => imageInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-cyan-100 text-cyan-700 rounded-lg hover:bg-cyan-200 transition">
            <span className="text-2xl">🖼️</span> Image
          </button>
          <button onClick={() => videoInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-cyan-100 text-cyan-700 rounded-lg hover:bg-cyan-200 transition">
            <span className="text-2xl">🎥</span> Video
          </button>
        </div>

        <div className="my-6 flex items-center gap-4">
          <hr className="flex-grow border-orange-200" />
          <span className="font-body text-gray-500">OR USE A REAL-TIME TOOL</span>
          <hr className="flex-grow border-orange-200" />
        </div>
        
        <div className="flex items-center justify-center gap-4">
            <button onClick={() => handleSelectRealTimeInput('drawing')} className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition">
                <span className="text-2xl">✏️</span> Draw
            </button>
            {/* FIX: The mode for START_REAL_TIME_INPUT should be a CaptureType, i.e., 'video' not 'recordingVideo'. */}
            <button onClick={() => handleSelectRealTimeInput('video')} className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition">
                <span className="text-2xl">📹</span> Record Video
            </button>
            {/* FIX: The mode for START_REAL_TIME_INPUT should be a CaptureType, i.e., 'audio' not 'recordingAudio'. */}
            <button onClick={() => handleSelectRealTimeInput('audio')} className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition">
                <span className="text-2xl">🎙️</span> Speak
            </button>
        </div>

        <div className="flex justify-center items-start gap-4">
            {image && (
            <div className="mt-6">
                <p className="font-body text-sm text-gray-600 mb-2">Image Preview</p>
                <img src={image.preview} alt="Preview" className="max-h-40 mx-auto rounded-lg shadow-md" />
            </div>
            )}
            {video && (
            <div className="mt-6">
                <p className="font-body text-sm text-gray-600 mb-2">Video Preview</p>
                <video src={video.preview} controls className="max-h-40 mx-auto rounded-lg shadow-md" />
            </div>
            )}
        </div>
      </div>

      <Button onClick={handleSubmit} className="mt-12" disabled={!text && !image && !video}>
        Next with Upload
      </Button>
    </div>
  );
};

export default InputModal;
