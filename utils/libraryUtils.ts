import { Book } from '../types';

const LIBRARY_KEY = 'ai_storybook_library';

export const loadLibraryFromStorage = (): Book[] => {
  try {
    const serializedLibrary = localStorage.getItem(LIBRARY_KEY);
    if (serializedLibrary === null) {
      return [];
    }
    return JSON.parse(serializedLibrary);
  } catch (error) {
    console.error("Could not load library from local storage", error);
    return [];
  }
};

export const saveLibraryToStorage = (library: Book[]): void => {
  try {
    const serializedLibrary = JSON.stringify(library);
    localStorage.setItem(LIBRARY_KEY, serializedLibrary);
  } catch (error) {
    console.error("Could not save library to local storage", error);
  }
};
