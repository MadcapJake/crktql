import { get, set } from 'idb-keyval';

export class BookManager {
    constructor() {
        this.book = {
            "0,0": { name: "Main", content: "", cursor: 0 }
        };
        this.currentPartKey = "0,0";
        this.filename = "untitled.htz";
        this.bookName = "Untitled Book";
        this.metadata = {
            writingSystem: 'Latin',
            font: 'Courier New'
        };
        // Runtime state for Sticky Column navigation (Goal Column)
        // Clears on reload (RAM only), satisfying requirement.
        this.desiredColumns = new Map();
    }

    setDesiredColumn(col) {
        this.desiredColumns.set(this.currentPartKey, col);
    }

    getDesiredColumn() {
        return this.desiredColumns.get(this.currentPartKey);
    }

    setTypingEngine(engine) {
        this.typingEngine = engine;
    }

    startNewBook(initialPartName = "Main", writingSystem = "Latin", font = "Courier New") {
        this.book = {
            "0,0": { name: initialPartName, content: "", cursor: 0 }
        };
        this.currentPartKey = "0,0";
        this.bookName = "Untitled Book";
        this.filename = "untitled_book.htz";
        this.metadata = {
            writingSystem: writingSystem,
            font: font
        };
        this.saveToStorage();
    }

    setBookName(name) {
        this.bookName = name.trim();
        // Filename: Replace spaces with underscores
        this.filename = this.bookName.replace(/\s+/g, '_') + '.htz';
        this.saveToStorage();
    }

    loadBook(jsonContent, filename) {
        try {
            const data = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;

            // Legacy Support: If data is just the book object (old format), wrap it?
            // Actually, previously data IS the book object map?
            // Lines 13-14: `this.book = data;`.
            // New format: data might be { book: {...}, metadata: {...}, bookName: ... } or just {...parts...}

            if (data.parts && data.metadata) {
                // New Format
                this.book = data.parts;
                this.metadata = data.metadata || { writingSystem: 'Latin', font: 'Courier New' };
                this.bookName = data.bookName || "Untitled Book";
            } else {
                // Old Format (Just parts map)
                this.book = data;
                this.metadata = { writingSystem: 'Latin', font: 'Courier New' };

                // Book Name from Filename
                if (filename) {
                    // Remove extension
                    const base = filename.replace(/\.htz$/i, '');
                    // Underscores to spaces
                    this.bookName = base.replace(/_/g, ' ');
                } else {
                    this.bookName = "Untitled Book";
                }
            }

            this.filename = filename || (this.bookName.replace(/\s+/g, '_') + '.htz');

            // Part Validation
            if (!this.book[this.currentPartKey]) {
                const keys = Object.keys(this.book);
                if (keys.length > 0) this.currentPartKey = keys[0];
                else {
                    this.book["0,0"] = { name: "Main", content: "", cursor: 0 };
                    this.currentPartKey = "0,0";
                }
            }
        } catch (e) {
            console.error("Failed to load book", e);
            throw new Error("Invalid .htz file");
        }
    }

    exportBook() {
        // Export Full Object
        const data = {
            parts: this.book,
            metadata: this.metadata,
            bookName: this.bookName
        };
        return JSON.stringify(data, null, 2);
    }

    getCurrentPart() {
        const part = this.book[this.currentPartKey];
        if (!part) return null;

        const [x, y] = this.currentPartKey.split(',').map(Number);
        return {
            ...part,
            x,
            y
        };
    }

    setCurrentPartContent(content) {
        if (this.book[this.currentPartKey]) {
            this.book[this.currentPartKey].content = content;
            this.saveToStorage();
        }
    }

    setPartCursor(cursorIndex) {
        if (this.book[this.currentPartKey]) {
            this.book[this.currentPartKey].cursor = cursorIndex;
            this.saveToStorage();
        }
    }

    createPart(x, y) {
        const key = `${x},${y}`;
        if (this.book[key]) return false; // Already exists

        this.book[key] = {
            name: this.typingEngine?.mappings?.STARTING_PART_NAME || "Unnamed",
            content: "",
            cursor: 0
        };
        this.saveToStorage();
        return true;
    }

    deletePart(x, y) {
        const key = `${x},${y}`;
        if (!this.book[key]) return false;

        delete this.book[key];

        // If we deleted the current part, reset to closest or 0,0
        if (this.currentPartKey === key) {
            const keys = Object.keys(this.book);
            this.currentPartKey = keys.length > 0 ? keys[0] : "0,0";
            if (keys.length === 0) {
                this.book["0,0"] = { name: "Main", content: "", cursor: 0 };
            }
        }
        this.saveToStorage();
        return true;
    }

    renamePart(x, y, newName) {
        const key = `${x},${y}`;
        if (this.book[key]) {
            this.book[key].name = newName;
        }
    }

    selectPart(x, y) {
        const key = `${x},${y}`;
        if (this.book[key]) {
            this.currentPartKey = key;
            return true;
        }
        return false;
    }

    getPart(x, y) {
        return this.book[`${x},${y}`];
    }

    getAllParts() {
        return this.book;
    }

    // Persistence
    saveToStorage() {
        if (this.saveTimeout) clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(async () => {
            try {
                const data = {
                    parts: this.book,
                    metadata: this.metadata,
                    bookName: this.bookName,
                    currentPartKey: this.currentPartKey,
                    filename: this.filename
                };

                // Use idb-keyval
                await set('active-book', data);
                console.log('[BookManager] Auto-saved book to IndexedDB');
            } catch (e) {
                console.error('[BookManager] Save failed:', e);
            }
        }, 1000); // 1s Debounce
    }

    async loadFromStorage() {
        try {
            // Retrieve from IndexedDB
            const data = await get('active-book');

            if (data) {
                // Handle Migration from Old Storage (which had .book = parts)
                if (data.parts) {
                    this.book = data.parts;
                    this.metadata = data.metadata || { writingSystem: 'Latin', font: 'Courier New' };
                    this.bookName = data.bookName || "Untitled Book";
                } else if (data.book) {
                    // Old format: data.book WAS the parts map
                    this.book = data.book;
                    this.metadata = { writingSystem: 'Latin', font: 'Courier New' };
                    this.bookName = "Untitled Book";
                }

                if (data.currentPartKey) this.currentPartKey = data.currentPartKey;
                if (data.filename) this.filename = data.filename;

                console.log('[BookManager] Loaded book from IndexedDB', { name: this.bookName });
                return true;
            }
        } catch (e) {
            console.error('[BookManager] Load failed:', e);
        }
        return false;
    }
}
