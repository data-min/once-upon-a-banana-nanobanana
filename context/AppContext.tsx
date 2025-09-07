import React, { createContext, useReducer, Dispatch, ReactNode } from 'react';
// FIX: Imported all necessary types from `types.ts` to resolve module errors.
import { AppState, AppAction, Book, CaptureType, GeneratedBook } from '../types';
import { DEFAULT_AGE } from '../constants';
import { loadLibraryFromStorage, saveLibraryToStorage } from '../utils/libraryUtils';

const initialState: AppState = {
  step: 'landing',
  age: DEFAULT_AGE,
  authorName: '',
  path: null,
  initialIdea: {},
  style: '',
  book: null,
  isLoading: false,
  loadingMessage: 'Getting ready...',
  error: null,
  currentPageIndex: 0,
  library: loadLibraryFromStorage(),
  captureContext: null,
};

const updateLibrary = (library: Book[], book: Book | null): Book[] => {
    if (!book) return library;
    const bookIndex = library.findIndex(b => b.id === book.id);
    const newLibrary = [...library];
    if (bookIndex > -1) {
        newLibrary[bookIndex] = book;
    } else {
        newLibrary.push(book);
    }
    saveLibraryToStorage(newLibrary);
    return newLibrary;
};

const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, step: action.payload };
    case 'SET_AGE':
      return { ...state, age: action.payload };
    case 'SET_AUTHOR_NAME':
      return { ...state, authorName: action.payload };
    case 'SET_PATH':
      return { ...state, path: action.payload };
    case 'SET_INITIAL_IDEA':
      return { ...state, initialIdea: action.payload };
    case 'SET_STYLE':
      return { ...state, style: action.payload };
    case 'START_GENERATION':
      return { ...state, isLoading: true, loadingMessage: action.payload, error: null };
    
    case 'GENERATION_SUCCESS': {
      const newBook: Book = {
        id: new Date().toISOString(),
        creationDate: new Date().toLocaleDateString(),
        age: state.age,
        style: state.style,
        author: state.authorName,
        title: action.payload.title,
        subtitle: action.payload.subtitle,
        characters: action.payload.characters,
        coverImageUrl: action.payload.coverImageUrl,
        pages: [action.payload.firstPage],
        isFinished: false,
      };
      const newLibrary = updateLibrary(state.library, newBook);
      // Start at index 0, which is the cover view
      return { ...state, isLoading: false, book: newBook, step: 'creating', currentPageIndex: 0, library: newLibrary, captureContext: null };
    }
    
    case 'FULL_BOOK_GENERATION_SUCCESS': {
        const fullBook = action.payload;
        const newBook: Book = {
            ...fullBook,
            age: state.age,
            style: state.style,
            author: state.authorName,
            isFinished: false, // Not finished until confirmed in viewer
        };
        const newLibrary = updateLibrary(state.library, newBook);
        return { 
            ...state, 
            isLoading: false, 
            book: newBook, 
            step: 'finished', // Go directly to the viewer for a full book
            currentPageIndex: 0,
            library: newLibrary,
            captureContext: null,
        };
    }
    
    case 'ADD_PAGE_SUCCESS': {
      if (!state.book) return { ...state, isLoading: false, error: "Book not found to add page" };
      const updatedBook = {
        ...state.book,
        pages: [...state.book.pages, action.payload]
      };
      const newLibrary = updateLibrary(state.library, updatedBook);
      return {
        ...state,
        isLoading: false,
        book: updatedBook,
        step: 'creating',
        // Navigate to the newly added page, which has an index of pages.length
        currentPageIndex: updatedBook.pages.length,
        library: newLibrary,
        captureContext: null,
      };
    }

    case 'END_STORY_SUCCESS': {
        if (!state.book) return { ...state, isLoading: false, error: "Book not found to end story" };
        const updatedBook = {
            ...state.book,
            pages: [...state.book.pages, action.payload],
            isFinished: false, // Not finished until confirmed in viewer
        };
        const newLibrary = updateLibrary(state.library, updatedBook);
        return {
          ...state,
          isLoading: false,
          book: updatedBook,
          step: 'finished', // Go to viewer for preview
          library: newLibrary,
        };
    }
      
    case 'REVISION_SUCCESS': {
        if (!state.book) return { ...state, isLoading: false, error: "Book not found for revision" };
        const pagesWithNewRevision = state.book.pages.map(p => {
            if (p.id === action.payload.pageId) {
                const newRevisions = [...p.revisions, action.payload.newRevision];
                return {
                    ...p,
                    revisions: newRevisions,
                    currentRevisionIndex: newRevisions.length - 1,
                };
            }
            return p;
        });
        const updatedBook = { ...state.book, pages: pagesWithNewRevision };
        const newLibrary = updateLibrary(state.library, updatedBook);
        return {
            ...state,
            isLoading: false,
            book: updatedBook,
            step: 'creating',
            library: newLibrary,
            captureContext: null,
        };
    }
    
    case 'REVISE_COVER_SUCCESS': {
        if (!state.book) return state;
        const updatedBook = { ...state.book, coverImageUrl: action.payload.newCoverImageUrl };
        const newLibrary = updateLibrary(state.library, updatedBook);
        return {
            ...state,
            isLoading: false,
            book: updatedBook,
            library: newLibrary,
        };
    }

    case 'SET_ACTIVE_REVISION': {
        if (!state.book) return state;
        const pagesWithActiveRevision = state.book.pages.map(p => {
            if (p.id === action.payload.pageId) {
                return { ...p, currentRevisionIndex: action.payload.revisionIndex };
            }
            return p;
        });
        const updatedBook = { ...state.book, pages: pagesWithActiveRevision };
        return { ...state, book: updatedBook };
    }

    case 'ADD_DEDICATION': {
        if (!state.book) return state;
        const updatedBook = { ...state.book, dedication: action.payload };
        const newLibrary = updateLibrary(state.library, updatedBook);
        return { ...state, book: updatedBook, library: newLibrary };
    }
      
    case 'GENERATION_FAILURE':
      return { ...state, isLoading: false, error: action.payload, step: state.captureContext?.from || state.step, captureContext: null };
    case 'SET_CURRENT_PAGE':
      return { ...state, currentPageIndex: action.payload };
    
    case 'LOAD_BOOK': {
        const bookToLoad = state.library.find(b => b.id === action.payload);
        if (!bookToLoad) {
            return { ...state, error: "Could not find book to load." };
        }
        return {
            ...state,
            book: bookToLoad,
            step: bookToLoad.isFinished ? 'finished' : 'creating',
            // If unfinished, go to last page. Last page index is pages.length
            currentPageIndex: bookToLoad.isFinished ? 0 : bookToLoad.pages.length,
        };
    }
    
    case 'FINISH_BOOK': {
        if (!state.book) return state;
        const finishedBook = { ...state.book, isFinished: true };
        const newLibrary = updateLibrary(state.library, finishedBook);
        return {
            ...state,
            book: finishedBook,
            library: newLibrary,
            step: 'library', // Go to library after finishing
        };
    }
    
    case 'EDIT_BOOK': {
        if (!state.book) return state;
        const unfinishedBook = { ...state.book, isFinished: false };
        const newLibrary = updateLibrary(state.library, unfinishedBook);
        return {
            ...state,
            book: unfinishedBook,
            library: newLibrary,
            step: 'creating',
            currentPageIndex: unfinishedBook.pages.length,
        };
    }
      
    case 'START_REAL_TIME_INPUT': {
        // FIX: The keys of this map must be of type CaptureType ('drawing', 'video', 'audio').
        const nextStepMap: Record<CaptureType, AppState['step']> = {
            drawing: 'drawing',
            video: 'recordingVideo',
            audio: 'recordingAudio'
        };
        return {
            ...state,
            step: nextStepMap[action.payload.mode],
            captureContext: {
                from: action.payload.from,
                pageId: action.payload.pageId,
                revisionType: action.payload.revisionType,
            }
        };
    }

    case 'CANCEL_REAL_TIME_INPUT': {
        return {
            ...state,
            step: state.captureContext?.from || 'landing',
            captureContext: null,
        }
    }

    case 'GENERATE_PAGE_VIDEO_SUCCESS': {
        if (!state.book) return state;
        const updatedPages = state.book.pages.map(p => {
            if (p.id === action.payload.pageId) {
                return { ...p, videoUrl: action.payload.videoUrl };
            }
            return p;
        });
        const updatedBook = { ...state.book, pages: updatedPages };
        const newLibrary = updateLibrary(state.library, updatedBook);
        return {
            ...state,
            isLoading: false,
            book: updatedBook,
            library: newLibrary,
        };
    }

    case 'RESET':
      return { ...initialState, library: state.library, step: 'age' };
    default:
      return state;
  }
};

export const AppContext = createContext<{
  state: AppState;
  dispatch: Dispatch<AppAction>;
}>({
  state: initialState,
  dispatch: () => null,
});

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};