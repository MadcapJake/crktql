
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EditorMode } from '../src/modes/EditorMode';

describe('EditorMode', () => {
    let editorMode;
    let mocks;

    beforeEach(() => {
        mocks = {
            typingEngine: {
                reset: vi.fn(),
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
                lastButtons: {}, // EditorMode reads this for Modifiers
                getActiveGamepad: vi.fn().mockReturnValue({})
            },
            renderer: {
                render: vi.fn()
            },
            showNotification: vi.fn(),
            onPaste: vi.fn(),
            onVisualSelect: vi.fn()
        };

        editorMode = new EditorMode({ ...mocks, onVisualSelect: mocks.onVisualSelect });
    });

    it('initializes correctly', () => {
        expect(editorMode).toBeDefined();
        // EditorMode specific init checks
    });

    describe('Navigation (Editor Specific overrides)', () => {
        // "Hello World"
        // 01234567890
        // Hello World

        it('handles Word Left: Jumps to start of word', () => {
            const frameInput = { buttons: { dpad: { left: true }, north: true } };
            // "Hello| World" (5) -> "|Hello World" (0)
            mocks.bookManager.getCurrentPart.mockReturnValue({ content: "Hello World", cursor: 5 });
            editorMode.handleInput(frameInput, {});
            expect(mocks.bookManager.setPartCursor).toHaveBeenCalledWith(0);
        });

        it('handles Word Left: Jumps over spaces and previous word', () => {
            const frameInput = { buttons: { dpad: { left: true }, north: true } };
            // "Hello World|" (11) -> "Hello |World" (6)
            mocks.bookManager.getCurrentPart.mockReturnValue({ content: "Hello World", cursor: 11 });
            editorMode.handleInput(frameInput, {});
            expect(mocks.bookManager.setPartCursor).toHaveBeenCalledWith(6);
        });

        it('handles Word Left: Punctuation is separate', () => {
            const frameInput = { buttons: { dpad: { left: true }, north: true } };
            // "Hello.World" (11) . at 5.
            // "Hello.W|orld" (7) -> "Hello.|World" (6)
            mocks.bookManager.getCurrentPart.mockReturnValue({ content: "Hello.World", cursor: 7 });
            editorMode.handleInput(frameInput, {});
            expect(mocks.bookManager.setPartCursor).toHaveBeenCalledWith(6);

            // Simulate release to reset 'justPressed' logic
            editorMode.handleInput({ buttons: { dpad: { left: false }, north: true } }, {});

            // "Hello.|World" (6) -> "Hello|.World" (5) (Dots are punct)
            // Wait, "Hello|.World". Left from 6 (.) -> 5?
            // "Start of current word". Current word is ".". Start is 5.
            // So 6 -> 5.
            mocks.bookManager.setPartCursor.mockClear();
            mocks.bookManager.getCurrentPart.mockReturnValue({ content: "Hello.World", cursor: 6 });
            editorMode.handleInput(frameInput, {});
            expect(mocks.bookManager.setPartCursor).toHaveBeenCalledWith(5);
        });

        it('handles Word Right: Jumps to end of word', () => {
            const frameInput = { buttons: { dpad: { right: true }, north: true } };
            // "H|ello World" (1) -> "Hello| World" (5)
            mocks.bookManager.getCurrentPart.mockReturnValue({ content: "Hello World", cursor: 1 });
            editorMode.handleInput(frameInput, {});
            expect(mocks.bookManager.setPartCursor).toHaveBeenCalledWith(5);
        });

        it('handles Word Right: Jumps over spaces to next word end', () => {
            const frameInput = { buttons: { dpad: { right: true }, north: true } };
            // "Hello| World" (5) -> "Hello World|" (11)
            mocks.bookManager.getCurrentPart.mockReturnValue({ content: "Hello World", cursor: 5 });
            editorMode.handleInput(frameInput, {});
            expect(mocks.bookManager.setPartCursor).toHaveBeenCalledWith(11);
        });
    });

    describe('Paste Trigger', () => {
        it('calls onPaste when Y + L3 is pressed', () => {
            // Need to set modifier held first or in same frame?
            // EditorMode checks `this.isModifierHeld = frameInput.buttons.north` at start.
            // Then checks `if (this.isModifierHeld ...)`

            mocks.typingEngine.state.mode = 'ONSET'; // Required for paste check

            const frameInput = {
                buttons: { dpad: {}, north: true, l3: true }
            };

            editorMode.handleInput(frameInput, {});
            expect(mocks.onPaste).toHaveBeenCalled();
        });
    });
});
