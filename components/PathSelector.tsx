import React, { useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { StoryPath } from '../types';

const PathCard: React.FC<{ title: string; description: string; icon: string; onClick: () => void }> = ({ title, description, icon, onClick }) => (
    <div 
        onClick={onClick}
        className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-lg cursor-pointer transform hover:scale-105 transition-transform duration-300 flex flex-col items-center text-center w-full md:w-80"
    >
        <span className="text-6xl mb-4">{icon}</span>
        <h3 className="font-display text-3xl text-cyan-500 mb-2">{title}</h3>
        <p className="font-body text-gray-600">{description}</p>
    </div>
);


const PathSelector: React.FC = () => {
  const { dispatch } = useContext(AppContext);

  const handleSelect = (path: StoryPath) => {
    dispatch({ type: 'SET_PATH', payload: path });
    dispatch({ type: 'SET_STEP', payload: 'author' });
  };

  return (
    <div className="text-center animate-fade-in flex flex-col items-center justify-center min-h-[80vh]">
       <div className="absolute top-[-1rem] left-0">
        <button onClick={() => dispatch({ type: 'SET_STEP', payload: 'age' })} className="font-body text-gray-500 hover:text-gray-800 transition p-4">&larr; Back</button>
      </div>
      <h2 className="font-display text-5xl md:text-7xl text-orange-500 mb-12">How would you like to start your story?</h2>
      <div className="flex flex-col md:flex-row gap-8">
        <PathCard 
            title="Let's write together, one page at a time"
            description="Let's create your book together, one magical page at a time."
            icon="📖"
            onClick={() => handleSelect('interactive')}
        />
        <PathCard 
            title="I already have a full story idea!"
            description="Tell the AI your whole idea and watch it bring your story to life all at once."
            icon="✍️"
            onClick={() => handleSelect('full')}
        />
      </div>
    </div>
  );
};

export default PathSelector;
