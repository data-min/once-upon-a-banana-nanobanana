import React, { useContext } from 'react';
import { AppContext } from '../context/AppContext';
import Button from './Button';

const LandingPage: React.FC = () => {
  const { state, dispatch } = useContext(AppContext);

  return (
    <div className="text-center animate-fade-in flex flex-col items-center justify-center min-h-[80vh]">
      <h1 className="font-display text-7xl md:text-9xl text-cyan-500 drop-shadow-lg mb-4">
        Create Your Own Book!
      </h1>
      <p className="font-body text-xl md:text-2xl text-gray-600 max-w-lg mx-auto mb-12">
        Turn your wildest ideas into magical stories and pictures with the help of a friendly AI!
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <Button onClick={() => dispatch({ type: 'RESET' })} className="animate-bounce-slow">
          Start My Book
        </Button>
        {state.library.length > 0 && (
          <Button onClick={() => dispatch({ type: 'SET_STEP', payload: 'library' })} variant="secondary">
            My Library
          </Button>
        )}
      </div>
    </div>
  );
};

export default LandingPage;