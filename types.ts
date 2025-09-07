// FIX: Removed circular self-import that caused declaration conflicts.
export type StoryPath = 'interactive' | 'full';

export type CaptureType = 'drawing' | 'video' | 'audio';

export interface CaptureData {
    type: CaptureType;
    base64: string;
    mimeType: string;
    transcript?: string;
    text?: string;
    mimicStyle?: boolean;
}

export interface InitialIdea {
  text?: string;
  imageBase64?: string;
  imageMimeType?: string;
  videoBase64?: string;
  videoMimeType?: string;
  capture?: CaptureData;
}

export interface Revision {
    text: string;
    imageUrl: string;
    type: 'initial' | 'text' | 'image';
    capture?: CaptureData;
    audioUrl?: string;
}

export interface Page {
    id: string;
    revisions: Revision[];
    currentRevisionIndex: number;
    videoUrl?: string;
}

export interface GeneratedBook {
    id: string;
    creationDate: string;
    title: string;
    subtitle: string;
    characters: string;
    coverImageUrl: string;
    pages: Page[];
    age: number;
    style: string;
}

export interface Book extends GeneratedBook {
    author: string;
    isFinished: boolean;
    dedication?: string;
}

export type AppStep = 'landing' | 'age' | 'path' | 'author' | 'input' | 'style' | 'creating' | 'finished' | 'library' | 'drawing' | 'recordingVideo' | 'recordingAudio';

export interface AppState {
  step: AppStep;
  age: number;
  authorName: string;
  path: StoryPath | null;
  initialIdea: InitialIdea;
  style: string;
  book: Book | null;
  isLoading: boolean;
  loadingMessage: string;
  error: string | null;
  currentPageIndex: number;
  library: Book[];
  captureContext: {
    from: 'input' | 'creating';
    pageId?: string;
    revisionType?: 'text' | 'image';
  } | null;
}

export type AppAction =
  | { type: 'SET_STEP'; payload: AppStep }
  | { type: 'SET_AGE'; payload: number }
  | { type: 'SET_AUTHOR_NAME'; payload: string }
  | { type: 'SET_PATH'; payload: StoryPath }
  | { type: 'SET_INITIAL_IDEA'; payload: InitialIdea }
  | { type: 'SET_STYLE'; payload: string }
  | { type: 'START_GENERATION'; payload: string }
  | { type: 'GENERATION_SUCCESS'; payload: { title: string; subtitle: string; characters: string; coverImageUrl: string; firstPage: Page } }
  | { type: 'FULL_BOOK_GENERATION_SUCCESS'; payload: GeneratedBook }
  | { type: 'ADD_PAGE_SUCCESS'; payload: Page }
  | { type: 'END_STORY_SUCCESS'; payload: Page }
  | { type: 'REVISION_SUCCESS'; payload: { pageId: string; newRevision: Revision } }
  | { type: 'REVISE_COVER_SUCCESS'; payload: { newCoverImageUrl: string } }
  | { type: 'SET_ACTIVE_REVISION'; payload: { pageId: string; revisionIndex: number } }
  | { type: 'ADD_DEDICATION'; payload: string }
  | { type: 'GENERATION_FAILURE'; payload: string }
  | { type: 'SET_CURRENT_PAGE'; payload: number }
  | { type: 'LOAD_BOOK'; payload: string }
  | { type: 'FINISH_BOOK' }
  | { type: 'EDIT_BOOK' }
  | { type: 'START_REAL_TIME_INPUT'; payload: { mode: CaptureType; from: 'input' | 'creating'; pageId?: string; revisionType?: 'text' | 'image' } }
  | { type: 'CANCEL_REAL_TIME_INPUT' }
  | { type: 'GENERATE_PAGE_VIDEO_SUCCESS'; payload: { pageId: string; videoUrl: string } }
  | { type: 'RESET' };