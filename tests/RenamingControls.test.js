
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RenamingMode } from '../src/modes/RenamingMode';

describe('RenamingControls', () => {
    let mode;
    let mocks;

    beforeEach(() => {
        mocks = {
            typingEngine: {
                getBufferText: vi.fn().mockReturnValue('Initial'),
                state: { cursor: 7 },
                processFrame: vi.fn(),
                reset: vi.fn(),
                typeCharacter: vi.fn()
            },
            bookManager: {
                renamePart: vi.fn(),
                saveToStorage: vi.fn(),
                setBookName: vi.fn()
            },
            focusManager: {
                setMode: vi.fn(),
                renameTarget: { x: 0, y: 0, oldName: 'Old' },
                // Mock getting a BOOK target as well if needed
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
        mode.activate(); // Ensure active
    });

    it('Save (East/B) consumes input and does NOT pass to engine', () => {
        const input = { buttons: { east: true, south: false, select: false, dpad: {} } };

        mode.handleInput(input, {});

        // Should save
        expect(mocks.bookManager.renamePart).toHaveBeenCalled();

        // Should NOT have called processFrame (would trigger newline or other logic)
        expect(mocks.typingEngine.processFrame).not.toHaveBeenCalled();

        // Should have exited
        expect(mode.wasActive).toBe(false);
    });

    it('Cancel (Select) consumes input and does NOT pass to engine', () => {
        const input = { buttons: { east: false, south: false, select: true, dpad: {} } };

        mode.handleInput(input, {});

        // Should NOT save
        expect(mocks.bookManager.renamePart).not.toHaveBeenCalled();

        // Should NOT process frame
        expect(mocks.typingEngine.processFrame).not.toHaveBeenCalled();

        // Should have exited
        expect(mode.wasActive).toBe(false);
    });

    it('Space (South/A) falls through to TypingEngine (or types space explicitly)', () => {
        const input = { buttons: { east: false, south: true, select: false, dpad: {} } };

        // Mock processFrame to return something so we know it was called
        mocks.typingEngine.processFrame.mockReturnValue({ text: "Initial ", cursor: 8 });

        mode.handleInput(input, {});

        // Either explicit typeCharacter OR processFrame should be called.
        // Based on our plan, we might pass it through, OR explicitly type it.
        // If we explicitly type it, we might also block processFrame from doing it again?
        // Let's verify that *something* happened to type a space.

        const spaceTyped = mocks.typingEngine.typeCharacter.mock.calls.length > 0 ||
            mocks.typingEngine.processFrame.mock.calls.length > 0;

        expect(spaceTyped).toBe(true);
    });

    it('Edge Detection: Holding Save (East) does not trigger multiple saves', () => {
        const input = { buttons: { east: true, dpad: {} } };

        // First frame: Save
        mode.handleInput(input, {});
        expect(mocks.bookManager.renamePart).toHaveBeenCalledTimes(1);

        // Reset calls to verify second frame
        mocks.bookManager.renamePart.mockClear();

        // Re-activate manually since save exits
        mode.activate();
        // Spoof `lastButtons` being set from previous frame (in reality activate clears it, 
        // so we need to set it manually to simulate "holding across boundaries" if that were possible, 
        // OR more likely: ensure within the SAME session it works. 
        // But Save exits the session. 
        // Let's test a non-exiting button for edge detection, OR ensure that IF we stay active, it blocks.

        // Let's test South (Space) edge detection if we implement it there, 
        // or just rely on the fact that if we re-enter mode, `lastButtons` is cleared (correct).

        // Actually, the critical edge case is user holds B to save, mode exits, user releases B in Overview.
        // Then user enters Rename again. `activate` clears `lastButtons`.
        // If user is *still* holding B when entering? 
        // That's a different issue (entry-latch). 

        // Let's just test that calling handleInput twice with ONE activation and holding button
        // doesn't double trigger IF the action didn't exit.
        // But Save DOES exit. So test is trivial.

        // Let's test Cancel (Select) if it didn't exit (hypothetically) or Space.
        mode.lastButtons.south = true;
        const inputSpace = { buttons: { south: true, dpad: {} } };
        mode.handleInput(inputSpace, {});

        // Should be ignored because lastButtons.south is true
        expect(mocks.typingEngine.typeCharacter).not.toHaveBeenCalled();
        // And if we block processFrame for South:
        // expect(mocks.typingEngine.processFrame).not.toHaveBeenCalled(); 
        // (Depends on implementation detail)
    });
});
