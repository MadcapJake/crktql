
export class HistoryManager {
    constructor(bookManager) {
        this.bookManager = bookManager;
        this.undoStack = [];
        this.redoStack = [];
        this.limit = 5000;
        this.sessionKey = 'crktqla_history';

        // Coalescing Helper
        this.lastOpTime = 0;
        this.COALESCE_WINDOW = 2000; // 2 seconds to break coalescing if idle? 
        // User asked for "adjacent text", usually time independent but let's keep it robust.
    }

    init() {
        this.loadFromSession();
    }

    push(op) {
        // op: { type, partKey, data: {}, timestamp }
        op.timestamp = Date.now();

        // Coalescing Logic
        if (this.undoStack.length > 0) {
            const last = this.undoStack[this.undoStack.length - 1];

            // Only coalesce TEXT operations on the same part
            if (last.partKey === op.partKey && last.type === op.type) {

                // 1. ADD TEXT
                if (op.type === 'ADD_TEXT') {
                    // Contiguous: Last index + Last length == New index
                    if (last.data.index + last.data.text.length === op.data.index) {
                        last.data.text += op.data.text;
                        last.timestamp = op.timestamp;
                        this.saveToSession();
                        return;
                    }
                }

                // 2. REMOVE TEXT
                else if (op.type === 'REMOVE_TEXT') {
                    // Backspace: New index == Last index - New length (deleting backward)
                    // Wait, standard backspace: cursor moves back.
                    // If I had "ABC", cursor at 3. Backspace "C" -> index 2.
                    // Next backspace "B" -> index 1.
                    // So Op1: index 2, text "C". Op2: index 1, text "B".
                    // last.index (2). op.index (1). op.text.length (1).
                    // last.index - op.data.text.length === op.data.index ?
                    if (last.data.index - op.data.text.length === op.data.index) {
                        // Prepend lost text (since we are deleting backwards)
                        // "C" then "B". We want "BC" removed at index 1.
                        last.data.text = op.data.text + last.data.text;
                        last.data.index = op.data.index;
                        last.timestamp = op.timestamp;
                        this.saveToSession();
                        return;
                    }

                    // Delete Forward: New index == Last index
                    // "ABC". Cursor 0. Delete "A" -> index 0.
                    // Cursor 0. Delete "B" -> index 0.
                    if (last.data.index === op.data.index) {
                        last.data.text += op.data.text;
                        last.timestamp = op.timestamp;
                        this.saveToSession();
                        return;
                    }
                }
            }
        }

        this.undoStack.push(op);
        if (this.undoStack.length > this.limit) {
            this.undoStack.shift();
        }

        // clear redo stack on new action
        this.redoStack = [];
        this.saveToSession();
    }

    async undo() {
        if (this.undoStack.length === 0) return null;

        const op = this.undoStack.pop();
        this.redoStack.push(op);
        this.saveToSession();

        return await this.applyOperation(op, true); // Return the RESULT (with navigateTo)
    }

    async redo() {
        if (this.redoStack.length === 0) return null;

        const op = this.redoStack.pop();
        this.undoStack.push(op);
        this.saveToSession();

        return await this.applyOperation(op, false); // Return the RESULT (with navigateTo)
    }

    async applyOperation(op, isUndo) {
        console.log(`[History] ${isUndo ? 'UNDO' : 'REDO'} ${op.type}`, op);
        const part = this.bookManager.book[op.partKey];

        // For Book Actions (Add/Delete Part), 'part' might not exist yet/anymore.

        // Return result indicating if we need to switch context
        const result = { type: op.type, navigateTo: null };

        switch (op.type) {
            case 'ADD_TEXT':
            case 'ADD_CITATION':
                if (isUndo) {
                    this._removeText(op.partKey, op.data.index, op.data.text.length);
                } else {
                    this._addText(op.partKey, op.data.index, op.data.text);
                }
                const [tx, ty] = op.partKey.split(',').map(Number);
                result.navigateTo = { x: tx, y: ty, mode: 'EDITOR' }; // Force EDITOR mode
                break;

            case 'REMOVE_TEXT':
            case 'REMOVE_CITATION':
                if (isUndo) {
                    this._addText(op.partKey, op.data.index, op.data.text);
                } else {
                    this._removeText(op.partKey, op.data.index, op.data.text.length);
                }
                // Determine coordinates from partKey (format "x,y")
                const [rx, ry] = op.partKey.split(',').map(Number);
                result.navigateTo = { x: rx, y: ry, mode: 'EDITOR' }; // Force EDITOR mode
                break;

            case 'ADD_PART':
                if (isUndo) {
                    this.bookManager.deletePart(op.data.x, op.data.y);
                    result.navigateTo = { x: op.data.x, y: op.data.y, mode: 'OVERVIEW' };
                } else {
                    this.bookManager.createPart(op.data.x, op.data.y);
                    result.navigateTo = { x: op.data.x, y: op.data.y, mode: 'OVERVIEW' };
                }
                break;

            case 'DELETE_PART':
                if (isUndo) {
                    this.bookManager.createPart(op.data.x, op.data.y);
                    const p = this.bookManager.getPart(op.data.x, op.data.y);
                    if (p) {
                        p.content = op.data.content;
                        p.name = op.data.name;
                    }
                    result.navigateTo = { x: op.data.x, y: op.data.y, mode: 'OVERVIEW' };
                } else {
                    this.bookManager.deletePart(op.data.x, op.data.y);
                    result.navigateTo = { x: op.data.x, y: op.data.y, mode: 'OVERVIEW' };
                }
                break;

            case 'RENAME_PART':
                const p2 = this.bookManager.getPart(op.data.x, op.data.y);
                if (p2) {
                    p2.name = isUndo ? op.data.oldName : op.data.newName;
                    result.navigateTo = { x: op.data.x, y: op.data.y, mode: 'OVERVIEW' }; // User Req: Jump to overview
                }
                break;
        }

        return result;
    }

    _addText(partKey, index, text) {
        const part = this.bookManager.book[partKey];
        if (!part) return;
        const c = part.content || "";
        // Ensure index is within bounds?
        const safeIndex = Math.min(index, c.length);
        const newC = c.slice(0, safeIndex) + text + c.slice(safeIndex);

        // Directly set content on the part object
        part.content = newC;
        // Move cursor to end of insertion
        part.cursor = safeIndex + text.length;

        // If this part happens to be the 'current' part in BookManager, we should ensure BookManager knows?
        // But BookManager just exposes the object from parts. So modifying property 'content' is enough
        // provided we force a re-render.
    }

    _removeText(partKey, index, length) {
        const part = this.bookManager.book[partKey];
        if (!part) return;
        const c = part.content || "";
        const safeIndex = Math.min(index, c.length);
        const newC = c.slice(0, safeIndex) + c.slice(safeIndex + length);

        part.content = newC;
        // Move cursor to start of deletion (original index)
        part.cursor = safeIndex;
    }

    saveToSession() {
        const data = {
            undo: this.undoStack,
            redo: this.redoStack
        };
        // Safely ignore quota errors?
        try {
            sessionStorage.setItem(this.sessionKey, JSON.stringify(data));
        } catch (e) {
            console.warn("SessionStorage full, history truncated?");
        }
    }

    loadFromSession() {
        try {
            const raw = sessionStorage.getItem(this.sessionKey);
            if (raw) {
                const data = JSON.parse(raw);
                this.undoStack = data.undo || [];
                this.redoStack = data.redo || [];
            }
        } catch (e) { console.error("History load failed", e); }
    }

    exportLogs() {
        return JSON.stringify({ undo: this.undoStack, redo: this.redoStack }, null, 2);
    }
}
