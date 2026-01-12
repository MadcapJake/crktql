
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EditorMode } from '../src/modes/EditorMode';
import { VisualSelectMode } from '../src/modes/VisualSelectMode';

describe('Clipboard Integration', () => {
    let editorMode;
    let visualSelectMode;
    let mocks;
    let clipboardStore = '';

    beforeEach(() => {
        // Mock Clipboard
        Object.assign(navigator, {
            clipboard: {
                writeText: vi.fn(async (t) => { clipboardStore = t; }),
                readText: vi.fn(async () => clipboardStore)
            }
        });
        clipboardStore = '';

        // Shared Mocks
        const bookManager = {
            getCurrentPart: vi.fn().mockReturnValue({ content: "Hello World", cursor: 0 }),
            setCurrentPartContent: vi.fn(),
            setPartCursor: vi.fn(), // Missing in previous mocks?
            currentPartKey: "0,0"
        };

        const renderer = { render: vi.fn() };
        const historyManager = { push: vi.fn() };
        const typingEngine = {
            reset: vi.fn(),
            processFrame: vi.fn(),
            resetInputState: vi.fn(),
            state: { mode: 'ONSET' },
            mappings: {}
        };
        const focusManager = { setMode: vi.fn() };
        const gamepadManager = { lastButtons: {}, getActiveGamepad: vi.fn().mockReturnValue({}) };
        const showNotification = vi.fn();

        mocks = { bookManager, renderer, historyManager, typingEngine, focusManager, gamepadManager, showNotification };

        editorMode = new EditorMode(mocks);
        visualSelectMode = new VisualSelectMode(mocks);

        // Inject callbacks
        editorMode.onVisualSelect = (cursor) => visualSelectMode.enter(cursor);
    });

    it('Copy and Paste flow', async () => {
        // 1. Setup Content
        const initialContent = "CopyMe";
        mocks.bookManager.getCurrentPart.mockReturnValue({ content: initialContent, cursor: 0 });

        // 2. Enter Visual Select
        visualSelectMode.enter(0); // Anchor at 0

        // 3. Move Cursor to end (simulate D-pad right 6 times)
        // Helper to simulate right press
        const pressRight = () => {
            visualSelectMode.handleInput({ buttons: { dpad: { right: true }, north: true } }); // Mod+Right (Word)? Or just right.
            // visualSelectMode logic: just right -> cursor + 1
            // Let's use simple logic
        };

        // For simplicity, we manually update cursor state in visualSelectMode (simulating movement)
        // VisualSelectMode reads cursor from part. So we update part.
        mocks.bookManager.getCurrentPart.mockReturnValue({ content: initialContent, cursor: 6 });

        // 4. Trigger Copy (A / South)
        await visualSelectMode.handleInput({ buttons: { south: true, dpad: {} }, lastButtons: {} });

        expect(navigator.clipboard.writeText).toHaveBeenCalledWith("CopyMe");
        expect(clipboardStore).toBe("CopyMe");

        // 5. Switch to Editor, Move Cursor, and Paste
        // Reset last buttons for Editor
        mocks.gamepadManager.lastButtons = {};

        // Simulate moving cursor to end of "Hello "
        mocks.bookManager.getCurrentPart.mockReturnValue({ content: "Hello ", cursor: 6 });

        // Trigger Paste (Y + L3)
        await editorMode.handleInput({ buttons: { l3: true, north: true, dpad: {} } }, {});

        // Wait for async paste
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(navigator.clipboard.readText).toHaveBeenCalled();
        expect(mocks.bookManager.setCurrentPartContent).toHaveBeenCalledWith("Hello CopyMe");
    });

    it('Cut and Paste flow', async () => {
        // 1. Setup Content
        const initialContent = "CutMe";
        mocks.bookManager.getCurrentPart.mockReturnValue({ content: initialContent, cursor: 0 });
        clipboardStore = "";

        // 2. Enter Visual Select
        visualSelectMode.enter(0);

        // 3. Move cursor to end
        mocks.bookManager.getCurrentPart.mockReturnValue({ content: initialContent, cursor: 5 });

        // 4. Trigger Cut (X / West)
        await visualSelectMode.handleInput({ buttons: { west: true, dpad: {} }, lastButtons: {} });

        expect(navigator.clipboard.writeText).toHaveBeenCalledWith("CutMe");
        expect(clipboardStore).toBe("CutMe");

        // Check content removal
        expect(mocks.bookManager.setCurrentPartContent).toHaveBeenCalledWith(""); // Removed "CutMe"

        // 5. Paste
        mocks.bookManager.getCurrentPart.mockReturnValue({ content: "Pasted: ", cursor: 8 });

        // Trigger Paste
        await editorMode.handleInput({ buttons: { l3: true, north: true, dpad: {} } }, {});

        // Wait for async paste
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(mocks.bookManager.setCurrentPartContent).toHaveBeenCalledWith("Pasted: CutMe");
    });
});
