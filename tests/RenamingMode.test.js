
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RenamingMode } from '../src/modes/RenamingMode';

describe('RenamingMode', () => {
    let mode;
    let mocks;

    beforeEach(() => {
        mocks = {
            typingEngine: {
                getBufferText: vi.fn().mockReturnValue('Initial'),
                state: { cursor: 7 },
                processFrame: vi.fn(),
                reset: vi.fn()
            },
            bookManager: {
                renamePart: vi.fn(),
                saveToStorage: vi.fn()
            },
            focusManager: {
                setMode: vi.fn(),
                renameTarget: { x: 0, y: 0, oldName: 'Old' }
            },
            editorRenderer: {
                render: vi.fn()
            },
            historyManager: {
                push: vi.fn()
            },
            overviewMode: {
                syncInputState: vi.fn()
            },
            gridOverview: {
                render: vi.fn()
            }
        };

        mode = new RenamingMode(mocks);
    });

    it('initializes with default state', () => {
        expect(mode.lastEngineTextLength).toBe(0);
        expect(mode.wasActive).toBe(false);
    });

    it('activates correctly', () => {
        mode.activate();
        expect(mode.lastEngineTextLength).toBe(7); // Length of "Initial"
        expect(mode.wasActive).toBe(true);
    });

    it('auto-activates on first input if not active', () => {
        const input = { buttons: { dpad: {}, east: false, select: false } };
        mode.handleInput(input, {}); // implicit activate
        expect(mode.wasActive).toBe(true);
        expect(mode.lastEngineTextLength).toBe(7);
    });

    it('handles saving (East button)', () => {
        const input = { buttons: { dpad: {}, east: true, select: false } };
        // We need to simulate lastDpad to allow latching?
        // RenamingMode handleInput: `if (frameInput.buttons.east && !this.lastDpad.east)`
        // Constructor defaults lastDpad to false. So this should trigger.

        mode.handleInput(input, {});

        expect(mocks.bookManager.renamePart).toHaveBeenCalledWith(0, 0, 'Initial');
        expect(mocks.bookManager.saveToStorage).toHaveBeenCalled();
        expect(mocks.focusManager.setMode).toHaveBeenCalledWith('OVERVIEW');
        expect(mode.wasActive).toBe(false); // Should deactivate on exit
    });

    it('handles cancelling (Select button)', () => {
        const input = { buttons: { dpad: {}, east: false, select: true } };
        mode.handleInput(input, {});

        expect(mocks.bookManager.renamePart).not.toHaveBeenCalled();
        expect(mocks.focusManager.setMode).toHaveBeenCalledWith('OVERVIEW');
        expect(mode.wasActive).toBe(false);
    });

    it('processes text changes via processTextChange logic', () => {
        // Activate first
        mode.activate(); // lastLength = 7 ("Initial")

        // Mock Typing Engine typing "InitialA" (insertion)
        mocks.typingEngine.getBufferText.mockReturnValue("Initial");
        mocks.typingEngine.state.cursor = 7;
        mocks.typingEngine.processFrame.mockReturnValue({ text: "InitialA" });

        const input = { buttons: { dpad: {} } };

        mode.handleInput(input, {});

        // It should detect insertion, update engine via reset (to sync logic), and render
        expect(mocks.typingEngine.reset).toHaveBeenCalledWith("InitialA");
        expect(mocks.editorRenderer.render).toHaveBeenCalledWith({ content: "InitialA", cursor: 8 });
    });
});
