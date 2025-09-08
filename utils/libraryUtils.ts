import { Book, MediaAttachment, Page, Revision } from '../types';
import { saveAsset, getAssetsForBook } from './assetDb';

const LIBRARY_KEY = 'ai_storybook_library';

const deepClone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

const ASSET_PLACEHOLDER_PREFIX = 'asset://';

const sanitizeBookForStorage = async (book: Book): Promise<Book> => {
    const sanitizedBook = deepClone(book);
    const assetPromises: Promise<void>[] = [];

    const processAsset = (dataUrl: string | undefined, id: string): string => {
        if (dataUrl && dataUrl.startsWith('data:')) {
            assetPromises.push(saveAsset(id, book.id, dataUrl));
            return `${ASSET_PLACEHOLDER_PREFIX}${id}`;
        }
        return dataUrl || '';
    };

    sanitizedBook.coverImageUrl = processAsset(book.coverImageUrl, `${book.id}-cover`);

    sanitizedBook.pages.forEach((page: Page, pageIndex: number) => {
        page.revisions.forEach((revision: Revision, revIndex: number) => {
            const assetId = `${book.id}-${page.id}-${revIndex}`;
            revision.imageUrl = processAsset(revision.imageUrl, assetId);
        });
    });

    if (sanitizedBook.initialIdea?.media) {
        sanitizedBook.initialIdea.media.forEach((item: MediaAttachment) => {
            if (item.type === 'image' && item.base64 && !item.base64.startsWith(ASSET_PLACEHOLDER_PREFIX)) {
                const assetId = `${book.id}-initial-${item.id}`;
                const dataUrl = `data:${item.mimeType};base64,${item.base64}`;
                const placeholder = processAsset(dataUrl, assetId);
                if (placeholder.startsWith(ASSET_PLACEHOLDER_PREFIX)) {
                    item.base64 = placeholder;
                    item.previewDataUrl = placeholder;
                }
            }
        });
    }

    await Promise.all(assetPromises);
    return sanitizedBook;
};

const hydrateBookFromStorage = async (sanitizedBook: Book): Promise<Book> => {
    const hydratedBook = deepClone(sanitizedBook);
    const assets = await getAssetsForBook(sanitizedBook.id);

    const getAsset = (placeholder: string): string => {
        if (placeholder && placeholder.startsWith(ASSET_PLACEHOLDER_PREFIX)) {
            const assetId = placeholder.substring(ASSET_PLACEHOLDER_PREFIX.length);
            return assets.get(assetId) || placeholder;
        }
        return placeholder;
    };
    
    hydratedBook.coverImageUrl = getAsset(sanitizedBook.coverImageUrl);

    hydratedBook.pages.forEach((page: Page) => {
        page.revisions.forEach((revision: Revision) => {
            revision.imageUrl = getAsset(revision.imageUrl);
        });
    });

    if (hydratedBook.initialIdea?.media) {
        hydratedBook.initialIdea.media.forEach((item: MediaAttachment) => {
            if (item.base64 && item.base64.startsWith(ASSET_PLACEHOLDER_PREFIX)) {
                const dataUrl = getAsset(item.base64);
                if (dataUrl.startsWith('data:')) {
                    const parts = dataUrl.split(',');
                    const mimeInfo = parts[0];
                    const base64Content = parts.length > 1 ? parts[1] : '';
                    const mimeType = mimeInfo.split(':')[1]?.split(';')[0] || item.mimeType;
                    
                    item.base64 = base64Content;
                    item.mimeType = mimeType;
                    item.previewDataUrl = dataUrl;
                }
            }
        });
    }

    return hydratedBook;
};


export const loadLibraryFromStorage = async (): Promise<Book[]> => {
  try {
    const serializedLibrary = localStorage.getItem(LIBRARY_KEY);
    if (serializedLibrary === null) {
      return [];
    }
    const sanitizedLibrary: Book[] = JSON.parse(serializedLibrary);
    
    const hydratedLibrary = await Promise.all(
        sanitizedLibrary.map(book => hydrateBookFromStorage(book))
    );
    
    return hydratedLibrary;
  } catch (error) {
    console.error("Could not load library from local storage", error);
    localStorage.removeItem(LIBRARY_KEY);
    return [];
  }
};

export const saveLibraryToStorage = async (library: Book[]): Promise<void> => {
  try {
    const sanitizedLibrary = await Promise.all(
        library.map(book => sanitizeBookForStorage(book))
    );
    const serializedLibrary = JSON.stringify(sanitizedLibrary);
    localStorage.setItem(LIBRARY_KEY, serializedLibrary);
  } catch (error) {
    console.error("Could not save library to local storage", error);
    // Don't re-throw, just log it. The app can continue running with in-memory state.
  }
};