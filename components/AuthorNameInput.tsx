import React, { useState, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import Button from './Button';

const AuthorNameInput: React.FC = () => {
  const { state, dispatch } = useContext(AppContext);
  const [name, setName] = useState(state.authorName || '');

  const handleSubmit = () => {
    dispatch({ type: 'SET_AUTHOR_NAME', payload: name });
    dispatch({ type: 'SET_STEP', payload: 'input' });
  };

  return (
    <div className="text-center animate-fade-in flex flex-col items-center justify-center min-h-[80vh]">
      <div className="absolute top-[-1rem] left-0">
        <button onClick={() => dispatch({ type: 'SET_STEP', payload: 'path' })} className="font-body text-gray-500 hover:text-gray-800 transition p-4">&larr; Back</button>
      </div>
      <h2 className="font-display text-5xl md:text-7xl text-orange-500 mb-8">What's the author's name?</h2>
      <div className="w-full max-w-md bg-white/70 p-8 rounded-2xl shadow-lg backdrop-blur-sm">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Lily"
          className="w-full p-4 font-body text-2xl border-2 text-center border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-400 focus:outline-none"
        />
        <p className="font-body text-gray-500 mt-4">This will be shown on the cover of your book!</p>
      </div>
      <Button onClick={handleSubmit} className="mt-12" disabled={!name}>
        Next
      </Button>
    </div>
  );
};

export default AuthorNameInput;
