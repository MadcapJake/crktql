
export class BookManager {
    constructor() {
        this.book = {
            "0,0": { name: "Main", content: "", cursor: 0 }
        };
        this.currentPartKey = "0,0";
        this.filename = "untitled.htz";
    }

    loadBook(jsonContent, filename) {
        try {
            const data = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
            this.book = data;
            this.filename = filename || "untitled.htz";

            // Find a valid part to default to if current is missing
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
        return JSON.stringify(this.book, null, 2);
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
        }
    }

    setPartCursor(cursorIndex) {
        if (this.book[this.currentPartKey]) {
            this.book[this.currentPartKey].cursor = cursorIndex;
        }
    }

    createPart(x, y) {
        const key = `${x},${y}`;
        if (this.book[key]) return false; // Already exists

        this.book[key] = {
            name: "Unnamed",
            content: "",
            cursor: 0
        };
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
}
