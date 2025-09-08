import React, { createContext, useReducer, Dispatch, ReactNode, useEffect, useRef } from 'react';
import { AppState, AppAction, Book, CaptureType, GeneratedBook, MediaAttachment } from '../types';
import { DEFAULT_AGE } from '../constants';
import { loadLibraryFromStorage, saveLibraryToStorage } from '../utils/libraryUtils';

const initialState: AppState = {
  step: 'landing',
  age: DEFAULT_AGE,
  authorName: '',
  path: null,
  initialIdea: { text: '', media: [] },
  style: '',
  book: null,
  isLoading: false,
  loadingMessage: 'Getting ready...',
  error: null,
  currentPageIndex: 0,
  library: [],
  isLibraryLoaded: false,
  captureContext: null,
};

const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, step: action.payload };
    case 'SET_LIBRARY':
      return { ...state, library: action.payload, isLibraryLoaded: true };
    case 'SET_AGE':
      return { ...state, age: action.payload };
    case 'SET_AUTHOR_NAME':
      return { ...state, authorName: action.payload };
    case 'SET_PATH':
      return { ...state, path: action.payload };
    case 'SET_INITIAL_IDEA':
      return { ...state, initialIdea: action.payload };
    case 'ADD_MEDIA_TO_INITIAL_IDEA':
       return {
        ...state,
        initialIdea: {
          ...state.initialIdea,
          media: [...state.initialIdea.media, action.payload],
        },
      };
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
        initialIdea: state.initialIdea,
      };
      
      const bookIndex = state.library.findIndex(b => b.id === newBook.id);
      const newLibrary = [...state.library];
      if (bookIndex > -1) {
          newLibrary[bookIndex] = newBook;
      } else {
          newLibrary.push(newBook);
      }

      return { ...state, isLoading: false, book: newBook, step: 'creating', currentPageIndex: 0, library: newLibrary, captureContext: null, initialIdea: { text: '', media: [] } };
    }
    
    case 'FULL_BOOK_GENERATION_SUCCESS': {
        const fullBook = action.payload;
        const newBook: Book = {
            ...fullBook,
            age: state.age,
            style: state.style,
            author: state.authorName,
            isFinished: false,
            initialIdea: state.initialIdea,
        };
        
        const bookIndex = state.library.findIndex(b => b.id === newBook.id);
        const newLibrary = [...state.library];
        if (bookIndex > -1) {
            newLibrary[bookIndex] = newBook;
        } else {
            newLibrary.push(newBook);
        }

        return { 
            ...state, 
            isLoading: false, 
            book: newBook, 
            step: 'creating',
            currentPageIndex: 0,
            library: newLibrary,
            captureContext: null,
            initialIdea: { text: '', media: [] },
        };
    }
    
    case 'ADD_PAGE_SUCCESS': {
      if (!state.book) return { ...state, isLoading: false, error: "Book not found to add page" };
      const updatedBook = {
        ...state.book,
        pages: [...state.book.pages, action.payload]
      };
      
      const bookIndex = state.library.findIndex(b => b.id === updatedBook.id);
      const newLibrary = [...state.library];
      if (bookIndex > -1) {
          newLibrary[bookIndex] = updatedBook;
      }

      return {
        ...state,
        isLoading: false,
        book: updatedBook,
        step: 'creating',
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
            isFinished: false,
        };
        
        const bookIndex = state.library.findIndex(b => b.id === updatedBook.id);
        const newLibrary = [...state.library];
        if (bookIndex > -1) {
            newLibrary[bookIndex] = updatedBook;
        }

        return {
          ...state,
          isLoading: false,
          book: updatedBook,
          step: 'finished',
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
        
        const bookIndex = state.library.findIndex(b => b.id === updatedBook.id);
        const newLibrary = [...state.library];
        if (bookIndex > -1) {
            newLibrary[bookIndex] = updatedBook;
        }
        
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
        
        const bookIndex = state.library.findIndex(b => b.id === updatedBook.id);
        const newLibrary = [...state.library];
        if (bookIndex > -1) {
            newLibrary[bookIndex] = updatedBook;
        }

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
        
        const bookIndex = state.library.findIndex(b => b.id === updatedBook.id);
        const newLibrary = [...state.library];
        if (bookIndex > -1) {
            newLibrary[bookIndex] = updatedBook;
        }
        
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
            currentPageIndex: bookToLoad.isFinished ? 0 : bookToLoad.pages.length,
        };
    }
    
    case 'FINISH_BOOK': {
        if (!state.book) return state;
        const finishedBook = { ...state.book, isFinished: true };
        
        const bookIndex = state.library.findIndex(b => b.id === finishedBook.id);
        const newLibrary = [...state.library];
        if (bookIndex > -1) {
            newLibrary[bookIndex] = finishedBook;
        }

        return {
            ...state,
            book: finishedBook,
            library: newLibrary,
            step: 'library',
        };
    }
    
    case 'EDIT_BOOK': {
        if (!state.book) return state;
        const unfinishedBook = { ...state.book, isFinished: false };
        
        const bookIndex = state.library.findIndex(b => b.id === unfinishedBook.id);
        const newLibrary = [...state.library];
        if (bookIndex > -1) {
            newLibrary[bookIndex] = unfinishedBook;
        }

        return {
            ...state,
            book: unfinishedBook,
            library: newLibrary,
            step: 'creating',
            currentPageIndex: unfinishedBook.pages.length,
        };
    }
      
    case 'START_REAL_TIME_INPUT': {
        const nextStepMap: Record<CaptureType, AppState['step']> = {
            drawing: 'drawing',
            video: 'recordingVideo',
            audio: 'recordingAudio',
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
        
        const bookIndex = state.library.findIndex(b => b.id === updatedBook.id);
        const newLibrary = [...state.library];
        if (bookIndex > -1) {
            newLibrary[bookIndex] = updatedBook;
        }

        return {
            ...state,
            isLoading: false,
            book: updatedBook,
            library: newLibrary,
        };
    }

    case 'HYDRATE_VIDEO_URLS': {
        if (!state.book) return state;
        const videoUrls = action.payload;
        const updatedPages = state.book.pages.map(p => {
            if (videoUrls[p.id]) {
                return { ...p, videoUrl: videoUrls[p.id] };
            }
            return p;
        });
        const updatedBook = { ...state.book, pages: updatedPages };
        return {
            ...state,
            book: updatedBook,
        };
    }

    case 'RESET':
      return { ...initialState, library: state.library, step: 'age', isLibraryLoaded: state.isLibraryLoaded };
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
  const previousLibraryRef = useRef<Book[] | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
        try {
            const loadedLibrary = await loadLibraryFromStorage();
            if (isMounted) {
                dispatch({ type: 'SET_LIBRARY', payload: loadedLibrary });
            }
        } catch (error) {
            console.error("Failed to load library on startup:", error);
            if (isMounted) {
                dispatch({ type: 'SET_LIBRARY', payload: [] });
            }
        }
    };
    loadData();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
      if (state.isLibraryLoaded && state.library !== previousLibraryRef.current) {
          if (previousLibraryRef.current !== null) {
              saveLibraryToStorage(state.library).catch(err => {
                  console.error("Could not save library to local storage", err);
              });
          }
      }
      previousLibraryRef.current = state.library;
  }, [state.library, state.isLibraryLoaded]);


  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};