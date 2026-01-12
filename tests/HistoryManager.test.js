
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HistoryManager } from '../src/data/HistoryManager';

describe('HistoryManager', () => {
    let historyManager;
    let mockBookManager;

    beforeEach(() => {
        mockBookManager = {
            selectPart: vi.fn(),
            setCurrentPartContent: vi.fn(),
            getCurrentPart: vi.fn()
        };

        // Mock SessionStorage
        const storage = {};
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => storage[key] || null);
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, v) => { storage[key] = v; });
        vi.spyOn(Storage.prototype, 'clear').mockImplementation(() => { for (const k in storage) delete storage[k]; });

        historyManager = new HistoryManager(mockBookManager);
        historyManager.init();
    });

    it('initializes with empty stacks', () => {
        expect(historyManager.undoStack).toHaveLength(0);
        expect(historyManager.redoStack).toHaveLength(0);
    });

    it('pushes operation and clears redo stack', () => {
        historyManager.redoStack = [{ type: 'OLD_REDO' }];

        historyManager.push({
            type: 'ADD_TEXT',
            partKey: '0,0',
            data: { text: 'a', index: 0 }
        });

        expect(historyManager.undoStack).toHaveLength(1);
        expect(historyManager.redoStack).toHaveLength(0);
        expect(sessionStorage.setItem).toHaveBeenCalled();
    });

    it('coalesces contiguous ADD_TEXT operations', () => {
        // Op 1: Type 'H' at 0
        historyManager.push({
            type: 'ADD_TEXT',
            partKey: '0,0',
            data: { text: 'H', index: 0 }
        });

        // Op 2: Type 'e' at 1
        historyManager.push({
            type: 'ADD_TEXT',
            partKey: '0,0',
            data: { text: 'e', index: 1 }
        });

        expect(historyManager.undoStack).toHaveLength(1);
        expect(historyManager.undoStack[0].data.text).toBe('He');
        expect(historyManager.undoStack[0].data.index).toBe(0);
    });

    it('coalesces contiguous REMOVE_TEXT operations (Backspace)', () => {
        // Op 1: Remove 'B' at 1 (from "AB") -> "A"
        historyManager.push({
            type: 'REMOVE_TEXT',
            partKey: '0,0',
            data: { text: 'B', index: 1 }
        });

        // Op 2: Remove 'A' at 0 (from "A") -> ""
        // This is a "Backspace" chain (index decreases)
        historyManager.push({
            type: 'REMOVE_TEXT',
            partKey: '0,0',
            data: { text: 'A', index: 0 }
        });

        expect(historyManager.undoStack).toHaveLength(1);
        // Should have merged into "AB" removed at index 0?
        // Logic: last.index (1) - op.text.length (1) === op.index (0). Yes.
        // Result: text = op.text (A) + last.text (B) = "AB". index = op.index (0).
        expect(historyManager.undoStack[0].data.text).toBe('AB');
        expect(historyManager.undoStack[0].data.index).toBe(0);
    });

    it('undo moves operation to redo stack', async () => {
        const op = { type: 'ADD_PART', partKey: '0,0', data: {} };
        historyManager.push(op);

        // Mock applyOperation to avoid logic complexity
        historyManager.applyOperation = vi.fn().mockResolvedValue({ mode: 'EDITOR' });

        const result = await historyManager.undo();

        expect(historyManager.undoStack).toHaveLength(0);
        expect(historyManager.redoStack).toHaveLength(1);
        expect(historyManager.applyOperation).toHaveBeenCalledWith(expect.objectContaining({ type: 'ADD_PART' }), true);
    });

    it('redo moves operation to undo stack', async () => {
        const op = { type: 'ADD_PART', partKey: '0,0', data: {} };
        historyManager.undoStack = [];
        historyManager.redoStack = [op];

        historyManager.applyOperation = vi.fn().mockResolvedValue({ mode: 'EDITOR' });

        await historyManager.redo();

        expect(historyManager.redoStack).toHaveLength(0);
        expect(historyManager.undoStack).toHaveLength(1);
        expect(historyManager.applyOperation).toHaveBeenCalledWith(expect.objectContaining({ type: 'ADD_PART' }), false);
    });
});
