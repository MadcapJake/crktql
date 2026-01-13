
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { VisualSelectMode } from '../src/modes/VisualSelectMode.js';

// Fully Mocked Deps
class MockBookManager {
    constructor() {
        this.book = { "0,0": { name: "Main", content: "", cursor: 0 } };
        this.currentPartKey = "0,0";
    }
    getCurrentPart() { return this.book[this.currentPartKey]; }
    setPartCursor(c) { this.getCurrentPart().cursor = c; }
    setCurrentPartContent(c) { this.getCurrentPart().content = c; }
}

class MockDeps {
    constructor() {
        this.bookManager = new MockBookManager();
        this.renderer = { render: () => { } };
        this.historyManager = { push: vi.fn() };
        this.gamepadManager = {
            lastButtons: {},
            getActiveGamepad: vi.fn().mockReturnValue(null) // Added for _exit safety
        };
        this.focusManager = { setMode: vi.fn() };
        this.typingEngine = {
            reset: vi.fn(),
            resetInputState: vi.fn()
        };
        this.showNotification = vi.fn();
        this.onExit = vi.fn();
    }
}

describe('VisualSelectMode Cut & Navigation', () => {
    let mode;
    let deps;

    beforeEach(() => {
        Object.defineProperty(global, 'navigator', {
            value: {
                clipboard: {
                    writeText: vi.fn().mockResolvedValue(undefined)
                }
            },
            writable: true,
            configurable: true
        });

        deps = new MockDeps();
        mode = new VisualSelectMode(deps);

        deps.bookManager.book["0,0"] = {
            name: "Main",
            content: "fodo mohodomo yonom",
            cursor: 0
        };
    });

    test('Basic Cut: Select "nom" (16-19)', () => {
        console.log(`[BasicCut] Starting\n`);
        deps.bookManager.setPartCursor(16); // Set cursor properly on the model
        mode.enter(16);

        deps.bookManager.setPartCursor(19); // Simulate cursor movement on model
        console.log(`[BasicCut] Entered. Cursor 19. Selection: ${mode._getSelectionText(deps.bookManager.getCurrentPart(), 19)}\n`);

        mode.handleInput({ buttons: { west: true, dpad: {} } });

        const part = deps.bookManager.getCurrentPart();
        console.log(`[BasicCut] Content after cut: "${part.content}"\n`);
        expect(part.content).toBe("fodo mohodomo yo");
    });

    test('Mod Entry Guard: Ignoring held Y on first frame', () => {
        deps.bookManager.setPartCursor(19);
        mode.enter(19);

        console.log(`Entered at 19. ignoreMod: ${mode.ignoreMod}\n`);

        mode.handleInput({
            buttons: { north: true, dpad: { left: true } }
        });

        const part = deps.bookManager.getCurrentPart();
        console.log(`After Input. Cursor: ${part.cursor}\n`);
        expect(part.cursor).toBe(18); // Left from 19 is 18
    });

    test('Mod Navigation: Re-pressing Y allows Word Jump', () => {
        deps.bookManager.setPartCursor(19);
        mode.enter(19);
        mode.handleInput({ buttons: { north: false, dpad: {} } }); // Release
        mode.handleInput({ buttons: { north: true, dpad: { left: true } } }); // Press
        const part = deps.bookManager.getCurrentPart();
        expect(part.cursor).toBe(14); // Jump word left from 19 ("yonom") -> 14 (" m");
    });
});
