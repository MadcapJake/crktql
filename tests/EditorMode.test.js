
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
        it('handles Word Left (Modifier + Left)', () => {
            const frameInput = {
                buttons: { dpad: { left: true }, north: true } // North = Modifier
            };

            // "Hello World", Cursor 5 (between 'o' and ' ')
            // Ctrl+Left should go to start of "Hello" -> 0

            editorMode.handleInput(frameInput, {});

            expect(mocks.bookManager.setPartCursor).toHaveBeenCalledWith(0);
        });

        it('handles standard Left navigation', () => {
            const frameInput = {
                buttons: { dpad: { left: true }, north: false }
            };
            // Cursor 5 -> 4
            mocks.bookManager.getCurrentPart.mockReturnValue({ content: "Hello World", cursor: 5 });

            editorMode.handleInput(frameInput, {});

            expect(mocks.bookManager.setPartCursor).toHaveBeenCalledWith(4);
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
