
const DB_NAME = 'ai-storybook-assets';
const STORE_NAME = 'assets';
const DB_VERSION = 1;

interface AssetRecord {
    id: string; // Composite key: e.g., `${bookId}-cover`
    bookId: string;
    assetData: string; // The full data URL string
}

const getDb = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(new Error("Failed to open IndexedDB for assets."));
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

export const saveAsset = async (id: string, bookId: string, assetData: string): Promise<void> => {
    try {
        const db = await getDb();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const record: AssetRecord = { id, bookId, assetData };
        store.put(record);
        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    } catch (error) {
        console.error(`Failed to save asset ${id} to IndexedDB:`, error);
        throw error;
    }
};

export const getAssetsForBook = async (bookId: string): Promise<Map<string, string>> => {
    try {
        const db = await getDb();
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('bookId');
        const request = index.getAll(bookId);

        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                const records: AssetRecord[] = request.result;
                const assetMap = new Map<string, string>();
                for (const record of records) {
                    assetMap.set(record.id, record.assetData);
                }
                resolve(assetMap);
            };
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error(`Failed to retrieve assets for book ${bookId} from IndexedDB:`, error);
        return new Map();
    }
};
