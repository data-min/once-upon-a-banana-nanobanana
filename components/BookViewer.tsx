
import React, { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext';
import Button from './Button';
import VideoGeneratorModal from './VideoGeneratorModal';
import AudioPlayer from './AudioPlayer';

const BookViewer: React.FC = () => {
  const { state, dispatch } = useContext(AppContext);
  const { book } = state;
  const [currentPageIndex, setCurrentPageIndex] = useState(0); // 0: cover, 1+: pages
  const [showDedicationModal, setShowDedicationModal] = useState(false);
  const [dedicationText, setDedicationText] = useState(book?.dedication || '');
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!book) {
    return (
        <div className="text-center font-display text-3xl text-red-500">
            Could not load your amazing story. Please try again!
        </div>
    );
  }

  const pageCount = book.pages.length;
  const totalItems = 1 + pageCount; // Cover + Pages

  const handleNext = () => {
    if (currentPageIndex < totalItems - 1) {
      setCurrentPageIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(prev => prev - 1);
    }
  };

  const handleAddDedication = () => {
    dispatch({ type: 'ADD_DEDICATION', payload: dedicationText });
    setShowDedicationModal(false);
  };
  
  const handleFinishBook = () => dispatch({ type: 'FINISH_BOOK' });
  const handleBackToEditor = () => {
      dispatch({ type: 'SET_CURRENT_PAGE', payload: book.pages.length });
      dispatch({ type: 'SET_STEP', payload: 'creating' });
  };
  const handleEditBook = () => dispatch({ type: 'EDIT_BOOK' });
  const handleBackToLibrary = () => dispatch({ type: 'SET_STEP', payload: 'library' });
  const handleCreateNew = () => dispatch({ type: 'RESET' });

  const handleShare = () => {
    navigator.clipboard.writeText('https://storybook.example.com/share/' + book.id);
    setCopied(true);
    setTimeout(() => {
        setCopied(false);
        setShowShareModal(false);
    }, 2000);
  };

  const renderCurrentItem = () => {
    // Cover Page
    if (currentPageIndex === 0) {
      return (
        <div className="w-full h-full flex items-center justify-center p-4">
            <img src={book.coverImageUrl} alt="Book Cover" className="max-w-full max-h-full object-contain rounded-lg shadow-lg" />
        </div>
      );
    }

    // Story Pages
    const pageIndex = currentPageIndex - 1;
    const page = book.pages[pageIndex];
    const revision = page.revisions[page.currentRevisionIndex];

    return (
        <div className="w-full h-full flex flex-row items-stretch">
            {/* Left Page: Image */}
            <div className="w-1/2 h-full flex items-center justify-center p-6 bg-white/50">
                {revision.imageUrl && <img src={revision.imageUrl} alt={`Illustration for page ${pageIndex + 1}`} className="w-full h-full object-contain" />}
            </div>
            {/* Right Page: Text */}
            <div className="w-1/2 h-full p-8 bg-amber-50 relative">
                <div className="w-full h-full flex items-center justify-center">
                    {revision.text && <p className="font-body text-xl md:text-2xl leading-relaxed text-gray-700 max-w-prose text-left">{revision.text}</p>}
                </div>
                {revision.audioUrl && (
                    <AudioPlayer src={revision.audioUrl} className="absolute top-6 right-6" />
                )}
            </div>
        </div>
    );
  };
  
  const allVideosGenerated = book.pages.every(p => !!p.videoUrl);

  const ActionButton: React.FC<{onClick: () => void, children: React.ReactNode, icon: string, disabled?: boolean}> = ({ onClick, children, icon, disabled }) => (
    <button onClick={onClick} className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-orange-600 bg-white/70 hover:bg-orange-100/80 rounded-full transition-all duration-200 shadow-sm font-body font-bold disabled:opacity-50 disabled:cursor-not-allowed" disabled={disabled}>
        <span className="text-xl">{icon}</span>
        {children}
    </button>
  );

  return (
    <div className="w-full">
      {showDedicationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full">
            <h3 className="font-display text-3xl text-orange-500 mb-4">Add a Dedication</h3>
            <textarea value={dedicationText} onChange={e => setDedicationText(e.target.value)} className="w-full p-2 border rounded font-body" placeholder="e.g., For Mom and Dad"></textarea>
            <div className="flex justify-end gap-2 mt-4">
              <Button onClick={() => setShowDedicationModal(false)} variant="secondary" className="text-xl">Cancel</Button>
              <Button onClick={handleAddDedication} className="text-xl">Save</Button>
            </div>
          </div>
        </div>
      )}
      
      {showShareModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center">
            <h3 className="font-display text-3xl text-orange-500 mb-4">Share Your Story!</h3>
            <p className="font-body text-gray-600 mb-6">Create and download the video, then share it with your friends and family!</p>
            <Button onClick={handleShare} className="w-full">
                {copied ? 'Copied!' : 'Copy Share Link'}
            </Button>
          </div>
        </div>
      )}
      
      {showVideoModal && book && <VideoGeneratorModal book={book} onClose={() => setShowVideoModal(false)} />}


      <div className="relative rounded-2xl aspect-[16/9] max-w-5xl mx-auto bg-amber-100 shadow-2xl overflow-hidden border-4 border-white">
        <div key={currentPageIndex} className="w-full h-full animate-fade-in">
            {renderCurrentItem()}
        </div>
      </div>

      <div className="flex justify-between items-center mt-6 max-w-5xl mx-auto">
        <Button variant="secondary" onClick={handlePrev} disabled={currentPageIndex === 0}>Previous</Button>

        <div className="flex flex-wrap justify-center items-center gap-3 font-body">
            {book.isFinished ? (
                <>
                    <ActionButton onClick={handleBackToLibrary} icon="📚">My Library</ActionButton>
                    <ActionButton onClick={handleEditBook} icon="✏️">Edit Story</ActionButton>
                    <ActionButton onClick={() => setShowVideoModal(true)} icon="🎬" disabled={!allVideosGenerated}>Create Full Story Video</ActionButton>
                    <ActionButton onClick={() => setShowShareModal(true)} icon="🔗">Share Link</ActionButton>
                    <Button onClick={handleCreateNew} variant="primary">Create New</Button>
                </>
            ) : (
                <>
                    {!book.dedication && <button onClick={() => setShowDedicationModal(true)} className="px-3 py-2 text-orange-700 hover:text-orange-900 transition font-bold">Add Dedication</button>}
                    <button onClick={handleBackToEditor} className="px-3 py-2 text-orange-700 hover:text-orange-900 transition font-bold">Back to Editor</button>
                    <Button onClick={handleFinishBook}>Save & Finish</Button>
                </>
            )}
        </div>

        <Button variant="secondary" onClick={handleNext} disabled={currentPageIndex >= totalItems - 1}>Next</Button>
      </div>
       {book.isFinished && !allVideosGenerated && <p className="text-center text-sm text-gray-500 mt-2">Edit this story to create a video for each page, then you can create the full story video.</p>}
       {!book.isFinished && state.path === 'full' && !allVideosGenerated && (
            <p className="text-center text-sm text-gray-500 mt-2">You can now create a video for each page before finishing your book!</p>
       )}
    </div>
  );
};

export default BookViewer;