import React, { useState, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { generateCoverAndFirstPage, generateFullBook, generateStylePreviewImage } from '../services/geminiService';
import { STYLE_OPTIONS } from '../constants';
import Button from './Button';

const StyleChip: React.FC<{ label: string; isSelected: boolean; onClick: () => void; }> = ({ label, isSelected, onClick }) => (
  <button 
    onClick={onClick}
    className={`px-4 py-2 rounded-full font-body text-lg transition-all duration-200 border-2 shadow-sm ${
      isSelected 
        ? 'bg-orange-500 text-white border-orange-500 transform scale-105' 
        : 'bg-white/80 hover:bg-orange-100 border-orange-200'
    }`}
  >
    {label}
  </button>
);

const StyleSelector: React.FC = () => {
  const { state, dispatch } = useContext(AppContext);
  const [selectedStyle, setSelectedStyle] = useState<string>('');
  const [customStyle, setCustomStyle] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const finalStyle = customStyle || selectedStyle;

  const handlePreview = async () => {
    if (!finalStyle || isPreviewLoading) return;
    setIsPreviewLoading(true);
    setPreviewImage(null);
    try {
        const imageUrl = await generateStylePreviewImage(state.initialIdea, finalStyle);
        setPreviewImage(imageUrl);
    } catch (err) {
        dispatch({ type: 'GENERATION_FAILURE', payload: err instanceof Error ? err.message : 'Could not generate style preview.' });
    } finally {
        setIsPreviewLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!finalStyle) return;
    dispatch({ type: 'SET_STYLE', payload: finalStyle });
    
    const onProgress = (message: string) => {
        dispatch({ type: 'START_GENERATION', payload: message });
    };

    onProgress('Dreaming up your story...');

    try {
        if (state.path === 'full') {
            const book = await generateFullBook(state.initialIdea, state.age, finalStyle, onProgress);
            dispatch({ type: 'FULL_BOOK_GENERATION_SUCCESS', payload: book });
        } else {
            const { title, subtitle, characters, coverImageUrl, firstPage } = await generateCoverAndFirstPage(state.initialIdea, state.age, finalStyle, onProgress);
            dispatch({ type: 'GENERATION_SUCCESS', payload: { title, subtitle, characters, coverImageUrl, firstPage } });
        }
    } catch (err) {
        console.error(err);
        dispatch({ type: 'GENERATION_FAILURE', payload: err instanceof Error ? err.message : 'An unknown error occurred.' });
        dispatch({ type: 'SET_STEP', payload: 'style' });
    }
  };
  
  return (
    <div className="text-center animate-fade-in flex flex-col items-center justify-center min-h-[80vh]">
      <div className="absolute top-[-1rem] left-0">
        <button onClick={() => dispatch({ type: 'SET_STEP', payload: 'input' })} className="font-body text-gray-500 hover:text-gray-800 transition p-4">&larr; Back</button>
      </div>
      <h2 className="font-display text-5xl md:text-7xl text-orange-500 mb-8">What should your story look like?</h2>
      <div className="w-full max-w-3xl bg-white/70 p-8 rounded-2xl shadow-lg backdrop-blur-sm">
        <div className="flex flex-wrap justify-center gap-3">
          {STYLE_OPTIONS.map(style => (
            <StyleChip 
              key={style}
              label={style}
              isSelected={selectedStyle === style && !customStyle}
              onClick={() => { setSelectedStyle(style); setCustomStyle(''); }}
            />
          ))}
        </div>
        <div className="my-6 flex items-center gap-4">
          <hr className="flex-grow border-orange-200" />
          <span className="font-body text-gray-500">OR</span>
          <hr className="flex-grow border-orange-200" />
        </div>
        <input 
          type="text"
          value={customStyle}
          onChange={(e) => { setCustomStyle(e.target.value); setSelectedStyle(''); }}
          placeholder="Describe your own style, e.g., 'Drawn like a happy dream'"
          className="w-full p-4 font-body text-lg border-2 border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-400 focus:outline-none"
        />

        <div className="mt-6 text-center">
            <Button onClick={handlePreview} disabled={!finalStyle || isPreviewLoading} variant="secondary">
                {isPreviewLoading ? 'Generating...' : 'Preview Style'}
            </Button>
            {isPreviewLoading && (
                <div className="mt-4 flex justify-center">
                    <div className="w-8 h-8 border-4 border-dashed rounded-full animate-spin border-cyan-500"></div>
                </div>
            )}
            {previewImage && !isPreviewLoading && (
                <div className="mt-4 p-2 bg-white/50 rounded-lg inline-block animate-fade-in">
                    <p className="font-body text-sm text-gray-600 mb-2">Style Sample</p>
                    <img src={previewImage} alt="Style preview" className="max-h-64 rounded-md shadow-lg" />
                </div>
            )}
        </div>
      </div>

      <Button onClick={handleGenerate} className="mt-12" disabled={!finalStyle} variant="primary">
        Generate My Book!
      </Button>
    </div>
  );
};

export default StyleSelector;