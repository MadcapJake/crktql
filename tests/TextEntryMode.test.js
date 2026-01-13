
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TextEntryMode } from '../src/modes/TextEntryMode';

describe('TextEntryMode', () => {
    let mode;
    let mocks;

    beforeEach(() => {
        mocks = {
            typingEngine: {
                reset: vi.fn(),
                getBufferText: vi.fn()
            },
            renderer: {
                render: vi.fn()
            }
        };
        mode = new TextEntryMode(mocks);
    });

    describe('navigate', () => {
        it('handles basic left/right navigation', () => {
            const content = 'Hello';
            let cursor = 2; // "He|llo"

            // Move Left
            // navigate takes (dpad, currentCursor, content, isSingleLine)
            // It expects `this.lastDpad` to be managed. TextEntryMode.navigate updates it?
            // Yes, `this.lastDpad = { ...dpad };` at end of navigate.

            // Frame 1: Left Pressed
            cursor = mode.navigate({ left: true, right: false, up: false, down: false }, cursor, content);
            expect(cursor).toBe(1);

            // Frame 2: Left Released
            cursor = mode.navigate({ left: false, right: false, up: false, down: false }, cursor, content);
            expect(cursor).toBe(1);

            // Frame 3: Right Pressed
            cursor = mode.navigate({ left: false, right: true, up: false, down: false }, cursor, content);
            expect(cursor).toBe(2);
        });

        it('handles boundary conditions', () => {
            const content = 'Hi';
            let cursor = 0;

            // Try Left at start
            cursor = mode.navigate({ left: true }, cursor, content);
            expect(cursor).toBe(0);

            cursor = 2; // End
            // Try Right at end
            cursor = mode.navigate({ right: true }, cursor, content);
            expect(cursor).toBe(2);
        });
    });

    describe('processTextChange', () => {
        it('calculates insertions', () => {
            // content "A", cursor 1. Engine becomes "AB".
            const result = mode.processTextChange("A", 1, "AB", 1, null);
            expect(result.newContent).toBe("AB");
            expect(result.newCursor).toBe(2);
            expect(result.diff).toBe(1);
        });

        it('calculates backspace', () => {
            // content "AB", cursor 2. Engine becomes "A".
            const result = mode.processTextChange("AB", 2, "A", 2, null);
            expect(result.newContent).toBe("A");
            expect(result.newCursor).toBe(1);
            expect(result.diff).toBe(-1);
        });

        it('handles atomic citation deletion (backspace)', () => {
            // Content: "Ref {{cite:1,1}}", Cursor at end.
            const content = "Ref {{cite:1,1}}";
            const cursor = content.length; // After '}}'

            // Engine simulates backspace by just popping 1 char usually, or we simulate "length - 1"
            const engineText = content.slice(0, content.length - 1); // "Ref {{cite:1,1}"

            // We expect processTextChange to detect '}}' before cursor and remove WHOLE tag
            const result = mode.processTextChange(content, cursor, engineText, content.length, { historyManager: { push: vi.fn() }, partKey: 'test' });

            expect(result.handledAtomic).toBe(true);
            expect(result.newContent).toBe("Ref ");
            expect(result.newCursor).toBe(4); // Length of "Ref "
        });
    });

    describe('renderIfChanged', () => {
        it('renders only when changed', () => {
            mode.renderIfChanged(mocks.renderer, "A", 1);
            expect(mocks.renderer.render).toHaveBeenCalledWith({ content: "A", cursor: 1 });
            mocks.renderer.render.mockClear();

            // Same
            mode.renderIfChanged(mocks.renderer, "A", 1);
            expect(mocks.renderer.render).not.toHaveBeenCalled();

            // Diff content
            mode.renderIfChanged(mocks.renderer, "B", 1);
            expect(mocks.renderer.render).toHaveBeenCalledWith({ content: "B", cursor: 1 });
        });
    });
});
