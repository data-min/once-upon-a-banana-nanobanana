import React, { useState, useContext, useRef, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { InitialIdea, CaptureType, MediaAttachment } from '../types';
import Button from './Button';
import { fileToBase64 } from '../utils/fileUtils';

const MediaPreview: React.FC<{ item: MediaAttachment; onRemove: (id: string) => void; }> = ({ item, onRemove }) => {
    return (
        <div className="relative group aspect-square bg-gray-100 rounded-lg overflow-hidden shadow-md">
            {item.type === 'image' && <img src={item.previewDataUrl} alt={item.fileName || 'Uploaded image'} className="w-full h-full object-cover" />}
            {item.type === 'video' && <video src={item.previewDataUrl} muted playsInline loop autoPlay className="w-full h-full object-cover" />}

            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                 <button 
                    onClick={() => onRemove(item.id)}
                    className="w-8 h-8 rounded-full bg-red-500 text-white font-bold text-lg flex items-center justify-center transform hover:scale-110 transition-transform"
                    aria-label="Remove media"
                >
                    &times;
                </button>
            </div>
             <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 truncate">
                {item.source === 'drawing' ? 'Your Drawing' : item.source === 'recording' ? 'Your Video' : item.fileName}
            </div>
        </div>
    );
}

const InputModal: React.FC = () => {
  const { state, dispatch } = useContext(AppContext);
  const [text, setText] = useState(state.initialIdea.text || '');
  const [media, setMedia] = useState<MediaAttachment[]>(state.initialIdea.media || []);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Revoke object URLs on cleanup
    return () => {
      media.forEach(item => {
        if (item.previewDataUrl.startsWith('blob:')) {
          URL.revokeObjectURL(item.previewDataUrl);
        }
      });
    };
  }, [media]);

  const handleAddMedia = async (files: FileList) => {
    for (const file of Array.from(files)) {
      const { base64, mimeType } = await fileToBase64(file);
      const isVideo = mimeType.startsWith('video/');
      const previewDataUrl = URL.createObjectURL(file);
      
      const newAttachment: MediaAttachment = {
        id: `${new Date().toISOString()}-${file.name}`,
        type: isVideo ? 'video' : 'image',
        source: 'upload',
        base64,
        mimeType,
        previewDataUrl,
        fileName: file.name,
      };
      setMedia(prev => [...prev, newAttachment]);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleAddMedia(e.target.files);
    e.target.value = ''; // Reset input to allow re-uploading the same file
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleAddMedia(e.target.files);
     e.target.value = '';
  };
  
  const handleRemoveMedia = (id: string) => {
    setMedia(prev => {
      const itemToRemove = prev.find(item => item.id === id);
      if (itemToRemove && itemToRemove.previewDataUrl.startsWith('blob:')) {
        URL.revokeObjectURL(itemToRemove.previewDataUrl);
      }
      return prev.filter(item => item.id !== id);
    });
  }

  const handleSubmit = async () => {
    const idea: InitialIdea = { text, media };
    dispatch({ type: 'SET_INITIAL_IDEA', payload: idea });
    dispatch({ type: 'SET_STEP', payload: 'style' });
  };
  
  const handleSelectRealTimeInput = (mode: CaptureType) => {
    // Save current state before navigating away
    const idea: InitialIdea = { text, media };
    dispatch({ type: 'SET_INITIAL_IDEA', payload: idea });
    dispatch({ type: 'START_REAL_TIME_INPUT', payload: { mode, from: 'input' } });
  };

  return (
    <div className="text-center animate-fade-in flex flex-col items-center justify-center min-h-[80vh]">
       <div className="absolute top-[-1rem] left-0">
        <button onClick={() => dispatch({ type: 'SET_STEP', payload: 'author' })} className="font-body text-gray-500 hover:text-gray-800 transition p-4">&larr; Back</button>
      </div>
      <h2 className="font-display text-5xl md:text-7xl text-orange-500 mb-8">Give us your idea — any way you like!</h2>
      
      <div className="w-full max-w-3xl bg-white/70 p-8 rounded-2xl shadow-lg backdrop-blur-sm">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g., A friendly dragon who is afraid of heights..."
          className="w-full h-24 p-4 font-body text-lg border-2 border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-400 focus:outline-none"
        />
        
        {media.length > 0 && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {media.map(item => <MediaPreview key={item.id} item={item} onRemove={handleRemoveMedia} />)}
            </div>
        )}
        
        <div className="flex items-center justify-center gap-4 mt-6">
          <input type="file" accept="image/*" onChange={handleImageChange} ref={imageInputRef} className="hidden" multiple />
          <input type="file" accept="video/*" onChange={handleVideoChange} ref={videoInputRef} className="hidden" multiple />
          <button onClick={() => imageInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-cyan-100 text-cyan-700 rounded-lg hover:bg-cyan-200 transition">
            <span className="text-2xl">🖼️</span> Add Image(s)
          </button>
          <button onClick={() => videoInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-cyan-100 text-cyan-700 rounded-lg hover:bg-cyan-200 transition">
            <span className="text-2xl">🎥</span> Add Video(s)
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
            <button onClick={() => handleSelectRealTimeInput('video')} className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition">
                <span className="text-2xl">📹</span> Record Video
            </button>
        </div>
      </div>

      <Button onClick={handleSubmit} className="mt-12" disabled={!text && media.length === 0}>
        Next
      </Button>
    </div>
  );
};

export default InputModal;