import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BookManager } from '../src/data/BookManager.js';
import * as idb from 'idb-keyval';

// Mock idb-keyval
vi.mock('idb-keyval', () => ({
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
}));

describe('BookManager (IndexedDB)', () => {
    let bookManager;

    beforeEach(() => {
        vi.useFakeTimers();
        bookManager = new BookManager();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should save to storage using idb-keyval (async)', async () => {
        bookManager.saveToStorage();

        // Fast-forward debounce
        vi.runAllTimers();
        await Promise.resolve();
        await Promise.resolve(); // extra ticks for async set

        expect(idb.set).toHaveBeenCalledTimes(1);
        expect(idb.set).toHaveBeenCalledWith('active-book', expect.objectContaining({
            bookName: "Untitled Book",
            filename: "untitled.htz"
        }));
    });

    it('should load from storage using idb-keyval', async () => {
        const mockData = {
            parts: { "0,0": { name: "Main", content: "Loaded Content", cursor: 5 } },
            metadata: { writingSystem: 'Latin', font: 'Arial' },
            bookName: "My Saved Book",
            filename: "my_saved_book.htz",
            currentPartKey: "0,0"
        };

        vi.mocked(idb.get).mockResolvedValue(mockData);

        const success = await bookManager.loadFromStorage();

        expect(idb.get).toHaveBeenCalledWith('active-book');
        expect(success).toBe(true);
        expect(bookManager.bookName).toBe("My Saved Book");
        expect(bookManager.getPart(0, 0).content).toBe("Loaded Content");
    });

    it('should handle missing storage data gracefully', async () => {
        vi.mocked(idb.get).mockResolvedValue(undefined);

        const success = await bookManager.loadFromStorage();

        expect(success).toBe(false);
        // Should retain default state
        expect(bookManager.bookName).toBe("Untitled Book");
    });

    it('should start a new book and trigger save', async () => {
        bookManager.startNewBook("Chapter 1", "Latin", "Roboto");

        vi.runAllTimers();
        await Promise.resolve();
        await Promise.resolve(); // extra ticks

        expect(idb.set).toHaveBeenCalledWith('active-book', expect.objectContaining({
            bookName: "Untitled Book",
            filename: "untitled_book.htz", // default logic in startNewBook
            metadata: expect.objectContaining({ font: "Roboto" })
        }));

        const part = bookManager.getPart(0, 0);
        expect(part.name).toBe("Chapter 1");
    });
});
