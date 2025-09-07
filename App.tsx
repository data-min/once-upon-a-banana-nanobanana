import React, { useContext } from 'react';
import { AppContext } from './context/AppContext';
import LandingPage from './components/LandingPage';
import AgeSelector from './components/AgeSelector';
import PathSelector from './components/PathSelector';
import AuthorNameInput from './components/AuthorNameInput';
import InputModal from './components/InputModal';
import StyleSelector from './components/StyleSelector';
import StoryCreator from './components/StoryCreator';
import BookViewer from './components/BookViewer';
import LoadingScreen from './components/LoadingScreen';
import Library from './components/Library';
import DrawingCanvas from './components/DrawingCanvas';
import VideoRecorder from './components/VideoRecorder';
// FIX: Import AudioRecorder to handle the new 'recordingAudio' step.
import AudioRecorder from './components/AudioRecorder';

const App: React.FC = () => {
  const { state } = useContext(AppContext);

  const renderStep = () => {
    if (state.isLoading) {
      return <LoadingScreen />;
    }

    switch (state.step) {
      case 'landing':
        return <LandingPage />;
      case 'age':
        return <AgeSelector />;
      case 'path':
        return <PathSelector />;
      case 'author':
        return <AuthorNameInput />;
      case 'input':
        return <InputModal />;
      case 'style':
        return <StyleSelector />;
      case 'creating':
        return <StoryCreator />;
      case 'finished':
        return <BookViewer />;
      case 'library':
        return <Library />;
      case 'drawing':
        return <DrawingCanvas />;
      case 'recordingVideo':
        return <VideoRecorder />;
      // FIX: Add case for 'recordingAudio' to render the AudioRecorder component.
      case 'recordingAudio':
        return <AudioRecorder />;
      default:
        return <LandingPage />;
    }
  };

  return (
    <div className="min-h-screen w-full font-body text-gray-800 flex flex-col items-center justify-center p-4 bg-gradient-to-br from-amber-50 to-orange-100">
      <main className="w-full max-w-4xl mx-auto relative">
        {renderStep()}
      </main>
      {state.error && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white p-4 rounded-lg shadow-lg animate-fade-in z-50">
          <p className="font-bold">An error occurred:</p>
          <p>{state.error}</p>
        </div>
      )}
    </div>
  );
};

export default App;
