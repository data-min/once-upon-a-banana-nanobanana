import React, { useContext, useState, useRef, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { generateNextPage, revisePage, generateStoryEnding, reviseCoverImage, generateSinglePageVideo } from '../services/geminiService';
import Button from './Button';
import { InitialIdea, Page, Book, CaptureType, MediaAttachment } from '../types';
import { fileToBase64 } from '../utils/fileUtils';
import { getVideosForBook } from '../utils/videoDb';

const CoverRevisionModal: React.FC<{
  book: Book;
  onClose: () => void;
}> = ({ book, onClose }) => {
    const { state, dispatch } = useContext(AppContext);
    const [prompt, setPrompt] = useState('');
    const [isRevising, setIsRevising] = useState(false);

    const handleRevise = async () => {
        if (!prompt) return;
        setIsRevising(true);
        dispatch({ type: 'START_GENERATION', payload: 'Re-imagining your cover...' });
        try {
            const { newCoverImageUrl } = await reviseCoverImage(book, prompt);
            dispatch({ type: 'REVISE_COVER_SUCCESS', payload: { newCoverImageUrl } });
            onClose();
        } catch (error) {
            dispatch({ type: 'GENERATION_FAILURE', payload: error instanceof Error ? error.message : "Failed to revise cover" });
        } finally {
            setIsRevising(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-8 max-w-lg w-full">
                <h3 className="font-display text-3xl text-orange-500 mb-4">Revise the Cover</h3>
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={`e.g., "Add a friendly sun in the sky"`}
                    className="w-full h-24 p-2 border rounded-lg font-body"
                    disabled={isRevising}
                />
                <div className="flex justify-end gap-4 mt-6">
                    <Button onClick={onClose} variant="secondary" className="text-xl px-6 py-2" disabled={isRevising}>Cancel</Button>
                    <Button onClick={handleRevise} className="text-xl px-6 py-2" disabled={!prompt || isRevising}>
                        {isRevising ? 'Revising...' : 'Revise'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

const RevisionModal: React.FC<{
  page: Page;
  characters: string;
  onClose: () => void;
}> = ({ page, characters, onClose }) => {
    const { state, dispatch } = useContext(AppContext);
    const [prompt, setPrompt] = useState('');
    const [isRevising, setIsRevising] = useState(false);
    const [revisionType, setRevisionType] = useState<'text' | 'image'>('text');

    const handleRevise = async () => {
        if (!prompt) return;
        setIsRevising(true);
        try {
            const { newRevision } = await revisePage(page, prompt, state.age, state.style, revisionType, characters);
            dispatch({ type: 'REVISION_SUCCESS', payload: { pageId: page.id, newRevision } });
            onClose();
        } catch (error) {
            dispatch({ type: 'GENERATION_FAILURE', payload: error instanceof Error ? error.message : "Failed to revise page" });
        } finally {
            setIsRevising(false);
        }
    };
    
    const handleSelectRealTimeInput = (mode: CaptureType) => {
        dispatch({ type: 'START_REAL_TIME_INPUT', payload: { mode, from: 'creating', pageId: page.id, revisionType } });
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-8 max-w-lg w-full">
                <h3 className="font-display text-3xl text-orange-500 mb-4">What should we change?</h3>
                <div className="flex justify-center gap-2 mb-4">
                    <button onClick={() => setRevisionType('text')} className={`px-4 py-2 rounded-full font-body ${revisionType === 'text' ? 'bg-orange-500 text-white' : 'bg-gray-200'}`}>Revise Text</button>
                    <button onClick={() => setRevisionType('image')} className={`px-4 py-2 rounded-full font-body ${revisionType === 'image' ? 'bg-orange-500 text-white' : 'bg-gray-200'}`}>Revise Image</button>
                </div>
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={`e.g., "Make the dragon purple" or "Make the story funnier"`}
                    className="w-full h-24 p-2 border rounded-lg font-body"
                    disabled={isRevising}
                />
                 <div className="my-4 flex items-center gap-4">
                    <hr className="flex-grow" /> <span className="text-gray-500">OR</span> <hr className="flex-grow" />
                </div>
                <div className="flex items-center justify-center gap-4">
                     <button onClick={() => handleSelectRealTimeInput('drawing')} className="flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition text-sm">✏️ Draw</button>
                     <button onClick={() => handleSelectRealTimeInput('video')} className="flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition text-sm">📹 Record</button>
                </div>
                <div className="flex justify-end gap-4 mt-6">
                    <Button onClick={onClose} variant="secondary" className="text-xl px-6 py-2" disabled={isRevising}>Cancel</Button>
                    <Button onClick={handleRevise} className="text-xl px-6 py-2" disabled={!prompt || isRevising}>
                        {isRevising ? 'Revising...' : 'Revise'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

const NextPageModal: React.FC<{
  onSubmit: (idea: InitialIdea) => Promise<void>;
  onClose: () => void;
}> = ({ onSubmit, onClose }) => {
  const [text, setText] = useState('');
  const [image, setImage] = useState<{ file: File; preview: string } | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const { state, dispatch } = useContext(AppContext);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage({
        file,
        preview: URL.createObjectURL(file),
      });
    }
  };

  const handleSubmit = async () => {
    if (!text && !image) return;
    let mediaAttachments: MediaAttachment[] = [];
    if (image) {
      const { base64, mimeType } = await fileToBase64(image.file);
      mediaAttachments.push({
          id: new Date().toISOString(),
          type: 'image',
          source: 'upload',
          base64,
          mimeType,
          previewDataUrl: image.preview,
          fileName: image.file.name,
      });
    }
    await onSubmit({ text, media: mediaAttachments });
  };

  const handleSelectRealTimeInput = (mode: CaptureType) => {
    dispatch({ type: 'START_REAL_TIME_INPUT', payload: { mode, from: 'creating' } });
    onClose();
  };


  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
        <div className="bg-amber-50 rounded-2xl p-8 max-w-lg w-full shadow-2xl border-4 border-white">
            <h3 className="font-display text-4xl text-orange-500 mb-6 text-center">What happens next?</h3>
            <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={`e.g., "The dragon meets a singing frog!"`}
                className="w-full h-24 p-3 border-2 border-orange-200 rounded-lg font-body text-lg focus:ring-2 focus:ring-orange-400 focus:outline-none"
                disabled={state.isLoading}
            />
             <div className="flex items-center justify-center gap-4 mt-4">
                <input type="file" accept="image/*" onChange={handleImageChange} ref={imageInputRef} className="hidden" />
                <button onClick={() => imageInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-cyan-100 text-cyan-700 rounded-lg hover:bg-cyan-200 transition disabled:opacity-50" disabled={state.isLoading}>
                    <span className="text-2xl">🖼️</span> Add an image
                </button>
            </div>
             <div className="my-4 flex items-center gap-4">
                <hr className="flex-grow" /> <span className="text-gray-500 text-sm">OR</span> <hr className="flex-grow" />
            </div>
            <div className="flex items-center justify-center gap-4">
                 <button onClick={() => handleSelectRealTimeInput('drawing')} className="flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition">✏️ Draw</button>
                 <button onClick={() => handleSelectRealTimeInput('video')} className="flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition">📹 Record</button>
            </div>
            {image && (
                <div className="mt-4 text-center">
                    <img src={image.preview} alt="Preview" className="max-h-32 mx-auto rounded-lg shadow-md" />
                </div>
            )}
            <div className="flex justify-center gap-4 mt-6">
                <Button onClick={onClose} variant="secondary" className="text-xl px-6 py-2" disabled={state.isLoading}>Cancel</Button>
                <Button onClick={handleSubmit} className="text-xl px-6 py-2" disabled={(!text && !image) || state.isLoading}>
                    {state.isLoading ? 'Creating...' : 'Create Page'}
                </Button>
            </div>
        </div>
    </div>
  );
};

const ReviewModal: React.FC<{
  book: Book;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ book, onCancel, onConfirm }) => {
    const initialMedia = book.initialIdea?.media || [];

    return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-fade-in">
        <div className="bg-amber-50 rounded-2xl p-8 max-w-4xl w-full shadow-2xl border-4 border-white">
            <h3 className="font-display text-4xl text-orange-500 mb-6 text-center">Review Your Masterpiece!</h3>
            
            {initialMedia.length > 0 && (
                <>
                    <h4 className="font-display text-2xl text-cyan-600 mb-2 text-left">Your Ideas:</h4>
                    <div className="flex overflow-x-auto gap-4 p-4 mb-6 bg-white/50 rounded-lg">
                        {initialMedia.map((item) => {
                            // Construct a persistent data URL from the stored base64 content.
                            // This avoids issues with temporary blob URLs being revoked.
                            const dataUrl = `data:${item.mimeType};base64,${item.base64}`;
                            return (
                                <div key={item.id} className="flex-shrink-0 w-32 text-center font-body">
                                    {item.type === 'image' && <img src={dataUrl} alt="Initial idea" className="w-full aspect-square object-cover rounded-md shadow-md mb-2" />}
                                    {item.type === 'video' && <video src={dataUrl} muted loop autoPlay playsInline className="w-full aspect-square object-cover rounded-md shadow-md mb-2" />}
                                    <p className="text-sm font-bold text-gray-700 truncate">
                                        {item.source === 'drawing' ? 'Your Drawing' : item.source === 'recording' ? 'Your Video' : item.fileName || 'Uploaded Idea'}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                    <hr className="my-4 border-orange-200" />
                </>
            )}

            <h4 className="font-display text-2xl text-cyan-600 mb-2 text-left">Your Story:</h4>
            <div className="flex overflow-x-auto gap-4 p-4 bg-white/50 rounded-lg">
                <div className="flex-shrink-0 w-32 text-center font-body">
                    <img src={book.coverImageUrl} alt="Cover" className="w-full aspect-[4/5] object-cover rounded-md shadow-md mb-2" />
                    <p className="text-sm font-bold text-gray-700">Cover</p>
                </div>
                {book.pages.map((page, index) => (
                    <div key={page.id} className="flex-shrink-0 w-32 text-center font-body">
                        <img src={page.revisions[page.currentRevisionIndex].imageUrl} alt={`Page ${index + 1}`} className="w-full aspect-[4/5] object-cover rounded-md shadow-md mb-2" />
                        <p className="text-sm font-bold text-gray-700">Page {index + 1}</p>
                    </div>
                ))}
            </div>
            <div className="flex justify-center gap-4 mt-6">
                <Button onClick={onCancel} variant="secondary">Keep Editing</Button>
                <Button onClick={onConfirm}>Preview My Book!</Button>
            </div>
        </div>
    </div>
    );
};

const StoryCreator: React.FC = () => {
  const { state, dispatch } = useContext(AppContext);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [showCoverRevisionModal, setShowCoverRevisionModal] = useState(false);
  const [showNextPageModal, setShowNextPageModal] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [videoGenerationProgress, setVideoGenerationProgress] = useState<{ [pageId: string]: { message: string; percentage: number } }>({});
  const [hasHydratedVideos, setHasHydratedVideos] = useState(false);

  const { book, currentPageIndex } = state;

  useEffect(() => {
    if (book && !hasHydratedVideos) {
        getVideosForBook(book.id).then(videoUrls => {
            if (Object.keys(videoUrls).length > 0) {
                dispatch({ type: 'HYDRATE_VIDEO_URLS', payload: videoUrls });
            }
            setHasHydratedVideos(true);
        });
    }
    // Cleanup function to revoke URLs when the component unmounts or book changes
    return () => {
        if (book) {
            book.pages.forEach(p => {
                if (p.videoUrl && p.videoUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(p.videoUrl);
                }
            });
        }
    };
  }, [book, hasHydratedVideos, dispatch]);

  const isCoverView = currentPageIndex === 0;
  const pageArrayIndex = currentPageIndex - 1;
  const currentPage = isCoverView ? null : book?.pages[pageArrayIndex];
  const currentRevision = currentPage?.revisions[currentPage.currentRevisionIndex];

  const handleAddNewPageClick = () => {
    if (state.path === 'interactive') {
        setShowNextPageModal(true);
    }
  };

  const handleGenerateNextPage = async (nextIdea: InitialIdea) => {
    if (state.path === 'interactive' && book) {
        dispatch({ type: 'START_GENERATION', payload: 'Writing the next page...' });
        setShowNextPageModal(false);
        try {
            const nextPage = await generateNextPage(book, nextIdea, state.age, state.style);
            dispatch({ type: 'ADD_PAGE_SUCCESS', payload: nextPage });
        } catch(err) {
            dispatch({ type: 'GENERATION_FAILURE', payload: err instanceof Error ? err.message : 'Failed to create next page.' });
        }
    }
  };

  const handleEndStory = async () => {
    if (state.path === 'interactive' && book) {
        dispatch({ type: 'START_GENERATION', payload: 'Writing the perfect ending...' });
        try {
            const finalPage = await generateStoryEnding(book, state.age, state.style);
            dispatch({ type: 'END_STORY_SUCCESS', payload: finalPage });
        } catch(err) {
            dispatch({ type: 'GENERATION_FAILURE', payload: err instanceof Error ? err.message : 'Failed to create the ending.' });
        }
    }
  };
  
  const handleSetActiveRevision = (index: number) => {
    if (!currentPage) return;
    dispatch({ type: 'SET_ACTIVE_REVISION', payload: { pageId: currentPage.id, revisionIndex: index } });
  };
  
  const handleGenerateVideo = async (pageToProcess: Page) => {
      if (!book || !pageToProcess || videoGenerationProgress[pageToProcess.id]) return;

      const onProgress = (message: string, percentage: number) => {
          setVideoGenerationProgress(prev => ({
              ...prev,
              [pageToProcess.id]: { message, percentage }
          }));
      };

      onProgress('Preparing to generate...', 0);

      try {
          const { videoUrl } = await generateSinglePageVideo(book, pageToProcess, onProgress);
          dispatch({ type: 'GENERATE_PAGE_VIDEO_SUCCESS', payload: { pageId: pageToProcess.id, videoUrl } });
      } catch (err) {
          dispatch({ type: 'GENERATION_FAILURE', payload: err instanceof Error ? err.message : 'Failed to create page video.' });
      } finally {
          setVideoGenerationProgress(prev => {
              const newProgress = { ...prev };
              delete newProgress[pageToProcess.id];
              return newProgress;
          });
      }
  };

  const handleConfirmFinish = () => {
    setIsReviewing(false);
    if (state.path === 'interactive') {
        handleEndStory();
    } else {
        dispatch({ type: 'SET_STEP', payload: 'finished' });
    }
  };

  if (!book) return <div className="text-center font-display text-3xl">Loading your amazing story...</div>;
  if (!isCoverView && (!currentPage || !currentRevision)) return <div className="text-center font-display text-3xl">Loading page...</div>;
  
  const isLastPage = currentPageIndex === book.pages.length;
  const pageVideoProgress = currentPage && videoGenerationProgress[currentPage.id];

  return (
    <div className="animate-fade-in">
        {showRevisionModal && currentPage && <RevisionModal page={currentPage} characters={book.characters || ''} onClose={() => setShowRevisionModal(false)} />}
        {showCoverRevisionModal && <CoverRevisionModal book={book} onClose={() => setShowCoverRevisionModal(false)} />}
        {showNextPageModal && <NextPageModal onSubmit={handleGenerateNextPage} onClose={() => setShowNextPageModal(false)} />}
        {isReviewing && book && <ReviewModal book={book} onCancel={() => setIsReviewing(false)} onConfirm={handleConfirmFinish} />}


        <h2 className="font-display text-center text-5xl md:text-7xl text-cyan-500 mb-2">{book.title}</h2>
        <p className="text-center font-body text-xl text-gray-500 mb-8">
            {isCoverView ? 'Cover' : `Page ${currentPageIndex} of ${book.pages.length}`}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start bg-white/80 p-6 rounded-2xl shadow-lg">
            {isCoverView ? (
                <>
                    <img src={book.coverImageUrl} alt="Book Cover" className="rounded-xl shadow-md w-full aspect-square object-cover" />
                    <div className="text-center flex flex-col justify-center items-center h-full">
                        <p className="font-body text-xl md:text-2xl leading-relaxed text-gray-700 mb-6">{book.subtitle}</p>
                        <button onClick={() => setShowCoverRevisionModal(true)} className="px-4 py-2 bg-orange-200 text-orange-800 rounded-lg">Revise Cover</button>
                    </div>
                </>
            ) : (
                <>
                    <img src={currentRevision!.imageUrl} alt={`Illustration for page ${currentPageIndex}`} className="rounded-xl shadow-md w-full aspect-square object-cover" />
                    <div className="flex flex-col h-full">
                        <p className="font-body text-xl md:text-2xl leading-relaxed text-gray-700 mb-6 flex-grow">{currentRevision!.text}</p>
                        
                        {currentPage!.revisions.length > 1 && (
                            <div className="flex items-center gap-4 mb-4 bg-orange-100/50 p-2 rounded-lg">
                                <button onClick={() => handleSetActiveRevision(currentPage!.currentRevisionIndex - 1)} disabled={currentPage!.currentRevisionIndex === 0} className="px-3 py-1 bg-white rounded-md shadow disabled:opacity-50">‹</button>
                                <span className="font-body text-sm text-orange-800 flex-grow text-center">Version {currentPage!.currentRevisionIndex + 1} of {currentPage!.revisions.length}</span>
                                <button onClick={() => handleSetActiveRevision(currentPage!.currentRevisionIndex + 1)} disabled={currentPage!.currentRevisionIndex === currentPage!.revisions.length - 1} className="px-3 py-1 bg-white rounded-md shadow disabled:opacity-50">›</button>
                            </div>
                        )}
                        <div className="flex flex-wrap gap-4 items-center">
                            <button onClick={() => setShowRevisionModal(true)} className="px-4 py-2 bg-orange-200 text-orange-800 rounded-lg">Revise Page</button>
                             {currentPage.videoUrl ? (
                                <video src={currentPage.videoUrl} controls className="w-full max-w-xs rounded-lg shadow-md mt-4"></video>
                            ) : pageVideoProgress ? (
                                <div className="w-full max-w-xs mt-4 p-3 bg-purple-100 rounded-lg animate-fade-in">
                                    <p className="font-body text-sm text-purple-800 font-bold mb-1">🎬 Creating Video...</p>
                                    <div className="w-full bg-purple-200 rounded-full h-2.5 my-2">
                                        <div className="bg-purple-600 h-2.5 rounded-full" style={{ width: `${pageVideoProgress.percentage}%`, transition: 'width 0.5s ease-in-out' }}></div>
                                    </div>
                                    <p className="font-body text-xs text-purple-700 truncate">{pageVideoProgress.message}</p>
                                </div>
                            ) : (
                                <button onClick={() => handleGenerateVideo(currentPage)} className="px-4 py-2 bg-purple-200 text-purple-800 rounded-lg flex items-center gap-2">
                                    🎬 Create Page Video
                                </button>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>

        <div className="flex justify-between items-center mt-8">
            <Button variant="secondary" onClick={() => dispatch({ type: 'SET_CURRENT_PAGE', payload: currentPageIndex - 1 })} disabled={currentPageIndex === 0}>
                Previous
            </Button>
            
            <div className="flex items-center gap-4">
              {!isLastPage && (
                  <Button onClick={() => dispatch({ type: 'SET_CURRENT_PAGE', payload: currentPageIndex + 1 })}>Next Page</Button>
              )}
              
              {isLastPage && state.path === 'interactive' && book.pages.length < 12 && (
                  <Button onClick={handleAddNewPageClick}>Add a New Page</Button>
              )}

              { (isLastPage || state.path === 'full') && (
                  <Button 
                    onClick={() => setIsReviewing(true)} 
                    variant={state.path === 'interactive' ? 'secondary' : 'primary'}
                  >
                    End Story Now
                  </Button>
              )}
            </div>
        </div>
    </div>
  );
};

export default StoryCreator;