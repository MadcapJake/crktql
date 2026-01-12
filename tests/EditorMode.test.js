
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EditorMode } from '../src/modes/EditorMode';

describe('EditorMode', () => {
    let editorMode;
    let mocks;

    beforeEach(() => {
        // Create fresh mocks for every test
        mocks = {
            typingEngine: {
                reset: vi.fn(),
                resetInputState: vi.fn(),
                processFrame: vi.fn().mockReturnValue(null),
                state: { mode: 'INITIAL', syllable: '' },
                mappings: {}
            },
            bookManager: {
                getCurrentPart: vi.fn().mockReturnValue({ content: "Hello World", cursor: 5 }),
                setCurrentPartContent: vi.fn(),
                setPartCursor: vi.fn(),
                currentPartKey: "0,0",
                selectPart: vi.fn()
            },
            historyManager: {
                undo: vi.fn().mockResolvedValue(null),
                redo: vi.fn().mockResolvedValue(null),
                push: vi.fn()
            },
            focusManager: {
                setMode: vi.fn()
            },
            gridOverview: {
                setCursor: vi.fn(),
                syncInputState: vi.fn(),
                updateView: vi.fn(),
                setLinkTarget: vi.fn()
            },
            visualizer: {
                update: vi.fn()
            },
            gamepadManager: {
                lastButtons: {},
                getActiveGamepad: vi.fn().mockReturnValue({})
            },
            renderer: {
                render: vi.fn()
            },
            showNotification: vi.fn(),
            onPaste: vi.fn()
        };

        // Inject onPaste as a custom dep for the test
        editorMode = new EditorMode({ ...mocks, onPaste: mocks.onPaste });
    });

    it('initializes correctly', () => {
        expect(editorMode).toBeDefined();
        expect(editorMode.lastEngineTextLength).toBe(0);
    });

    it('handles navigation left (word)', () => {
        const frameInput = {
            buttons: { dpad: { left: true }, north: false } // No modifier
        };

        // Mock part: "Hello World", Cursor 5 (between o and W) -> expect 4
        mocks.bookManager.getCurrentPart.mockReturnValue({ content: "Hello World", cursor: 5 });

        editorMode.handleInput(frameInput, {});

        expect(mocks.bookManager.setPartCursor).toHaveBeenCalledWith(4);
        expect(mocks.renderer.render).toHaveBeenCalled();

        // LATENCY FIX VERIFICATION:
        // Ensure the part passed to render has the NEW cursor
        const renderCall = mocks.renderer.render.mock.calls[0];
        const partPassed = renderCall[0];
        expect(partPassed.cursor).toBe(4);
    });

    it('handles atomic citation skipping (Right)', () => {
        const frameInput = { buttons: { dpad: { right: true }, north: false } };
        // Content: "See {{cite:1,1}}."
        // Cursor at 4 (' ')
        // Next step: inside the tag?
        // Tag starts at 4. "{{".
        // Logic checks if cursor strictly INSIDE.
        // If we move right from 4 -> 5.

        const content = "The {{cite:1,1}} tag";
        //                 01234567890123456789
        // Tag: 4 to 16.
        mocks.bookManager.getCurrentPart.mockReturnValue({ content: content, cursor: 4 });

        editorMode.handleInput(frameInput, {});

        // It should start by moving to 5 (standard right).
        // Then atomic check confirms 5 is inside 4-16.
        // It snaps to 16 (End).

        expect(mocks.bookManager.setPartCursor).toHaveBeenCalledWith(16);
    });

    it('typing inserts text and updates renderer', () => {
        const frameInput = { buttons: { dpad: {} } };
        mocks.typingEngine.processFrame.mockReturnValue({
            text: "TestA",
            mode: 'ONSET'
        });
        // Simulating state where previous length was 4 ("Test")
        editorMode.lastEngineTextLength = 4;
        mocks.bookManager.getCurrentPart.mockReturnValue({ content: "Test", cursor: 4 });

        editorMode.handleInput(frameInput, {});

        expect(mocks.historyManager.push).toHaveBeenCalledWith(expect.objectContaining({ type: 'ADD_TEXT' }));
        expect(mocks.bookManager.setCurrentPartContent).toHaveBeenCalledWith("TestA");
        expect(mocks.renderer.render).toHaveBeenCalled();
    });

    it('undo triggers history manager', () => {
        const frameInput = {
            buttons: { lt: true, north: true, dpad: {} } // Undo Combo
        };

        editorMode.handleInput(frameInput, {});
        expect(mocks.historyManager.undo).toHaveBeenCalled();
    });

    it('activates visual select on Y + RB', () => {
        const frameInput = {
            buttons: { rb: true, north: true, dpad: {} }
        };

        editorMode.handleInput(frameInput, {});
        expect(mocks.focusManager.setMode).toHaveBeenCalledWith('VISUAL_SELECT');
        expect(editorMode.selectionAnchor).not.toBeNull();
    });
});
