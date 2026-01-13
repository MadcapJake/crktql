
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
    describe('Word Navigation', () => {
        it('navigateWordLeft: Jumps to start of word', () => {
            // "Hello World"
            //        ^ (7) 'W'
            const content = "Hello World";
            const result = mode.navigateWordLeft(7, content);
            expect(result).toBe(6); // Start of 'World'
        });

        it('navigateWordLeft: Jumps over spaces and previous word', () => {
            // "Hello World"
            //       ^ (6) 'W'
            const content = "Hello World";
            const result = mode.navigateWordLeft(6, content);
            expect(result).toBe(0); // Start of 'Hello'
        });

        it('navigateWordRight: Jumps to end of word', () => {
            // "Hello World"
            //  ^ (1) 'e'
            const content = "Hello World";
            const result = mode.navigateWordRight(1, content);
            expect(result).toBe(5); // End of 'Hello' (index 5 is space)
        });

        it('navigateWordRight: Jumps over spaces to next word end', () => {
            // "Hello World"
            //       ^ (5) ' '
            const content = "Hello World";
            const result = mode.navigateWordRight(5, content);
            expect(result).toBe(11); // End of 'World'
        });

        it('handles Ghost Boundary Regression (concatenation)', () => {
            // Scenario: "fodomodo tolobowo" -> delete space -> "fodomodotolobowo"
            // User reported stopping at old space index (8).

            const content = "fodomodotolobowo"; // 16 chars
            let cursor = 0;

            // Move Right
            cursor = mode.navigateWordRight(cursor, content);

            // "fodomodotolobowo" is ONE word.
            // Should jump to end (16).
            // Logic: Scan for SPACE? No space.
            // Scan for WORD type. 'f' is word. Iterate until non-word or end.
            // Should reach 16.
            expect(cursor).toBe(16);
        });
    });
});
