import React, { useContext } from 'react';
import { AppContext } from '../context/AppContext';
import Button from './Button';

const Library: React.FC = () => {
  const { state, dispatch } = useContext(AppContext);

  const handleLoadBook = (bookId: string) => {
    dispatch({ type: 'LOAD_BOOK', payload: bookId });
  };
  
  const handleNewBook = () => {
      dispatch({ type: 'RESET' });
  };

  return (
    <div className="text-center animate-fade-in flex flex-col items-center justify-center min-h-[80vh]">
      <h2 className="font-display text-5xl md:text-7xl text-orange-500 mb-12">My Story Library</h2>
      {state.library.length === 0 ? (
        <div className="flex flex-col items-center">
            <p className="font-body text-xl text-gray-600 mb-8">You haven't created any stories yet!</p>
            <img src="https://storage.googleapis.com/genai-downloads/images/storybook/empty-library.png" alt="Empty bookshelf" className="w-64" />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 max-w-4xl mb-8">
          {state.library.map(book => (
            <div 
              key={book.id} 
              onClick={() => handleLoadBook(book.id)}
              className="bg-white/80 p-3 rounded-lg shadow-md cursor-pointer transform hover:scale-105 transition-transform group"
            >
              <img src={book.coverImageUrl} alt={book.title} className="w-full aspect-[4/5] object-cover rounded-md mb-2 shadow-inner" />
              <h3 className="font-body font-bold text-gray-700 truncate group-hover:text-orange-600">{book.title}</h3>
              <p className="text-sm text-gray-500">{book.isFinished ? "Finished" : "In Progress"}</p>
            </div>
          ))}
        </div>
      )}
      <Button onClick={handleNewBook} className="mt-8">
        Create a New Story
      </Button>
    </div>
  );
};

export default Library;
