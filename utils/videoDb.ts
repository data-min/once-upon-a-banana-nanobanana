
const DB_NAME = 'ai-storybook-videos';
const STORE_NAME = 'videos';
const DB_VERSION = 1;

interface VideoRecord {
    id: string; // Composite key: `${bookId}-${pageId}`
    bookId: string;
    pageId: string;
    videoBlob: Blob;
}

const getDb = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(new Error("Failed to open IndexedDB."));
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('bookId', 'bookId');
            }
        };
    });
};

export const saveVideo = async (bookId: string, pageId: string, videoBlob: Blob): Promise<void> => {
    try {
        const db = await getDb();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const record: VideoRecord = {
            id: `${bookId}-${pageId}`,
            bookId,
            pageId,
            videoBlob,
        };
        store.put(record);
        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    } catch (error) {
        console.error("Failed to save video to IndexedDB:", error);
    }
};

export const getVideosForBook = async (bookId: string): Promise<{ [pageId: string]: string }> => {
    try {
        const db = await getDb();
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('bookId');
        const request = index.getAll(bookId);

        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                const records: VideoRecord[] = request.result;
                const videoUrls: { [pageId: string]: string } = {};
                for (const record of records) {
                    if (record.videoBlob) {
                        videoUrls[record.pageId] = URL.createObjectURL(record.videoBlob);
                    }
                }
                resolve(videoUrls);
            };
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error("Failed to retrieve videos from IndexedDB:", error);
        return {};
    }
};

export const clearVideosForBook = async (bookId: string): Promise<void> => {
    try {
        const db = await getDb();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('bookId');
        const request = index.getAllKeys(bookId);

        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                const keys = request.result;
                keys.forEach(key => store.delete(key as IDBValidKey));
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
            };
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error("Failed to clear videos from IndexedDB:", error);
    }
};
