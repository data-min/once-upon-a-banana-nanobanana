

import React, { useState, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import Button from './Button';
import { MIN_AGE, MAX_AGE, DEFAULT_AGE } from '../constants';

const AgeSelector: React.FC = () => {
  const { dispatch } = useContext(AppContext);
  const [age, setAge] = useState(DEFAULT_AGE);

  const handleSubmit = () => {
    dispatch({ type: 'SET_AGE', payload: age });
    dispatch({ type: 'SET_STEP', payload: 'path' });
  };

  return (
    <div className="text-center animate-fade-in flex flex-col items-center justify-center min-h-[80vh]">
       <div className="absolute top-[-1rem] left-0">
        <button onClick={() => dispatch({ type: 'SET_STEP', payload: 'landing' })} className="font-body text-gray-500 hover:text-gray-800 transition p-4">&larr; Back</button>
      </div>
      <h2 className="font-display text-5xl md:text-7xl text-orange-500 mb-8">How old is the storyteller?</h2>
      <div className="w-full max-w-md bg-white/70 p-8 rounded-2xl shadow-lg backdrop-blur-sm">
        <span className="font-display text-8xl text-cyan-500">{age}</span>
        <input
          type="range"
          min={MIN_AGE}
          max={MAX_AGE}
          value={age}
          onChange={(e) => setAge(Number(e.target.value))}
          className="w-full h-4 bg-orange-200 rounded-lg appearance-none cursor-pointer range-lg accent-orange-500 my-8"
        />
        <div className="flex justify-between text-gray-500 font-body">
          <span>Age {MIN_AGE}</span>
          <span>Age {MAX_AGE}</span>
        </div>
      </div>
      <Button onClick={handleSubmit} className="mt-12">
        Next
      </Button>
    </div>
  );
};

export default AgeSelector;
