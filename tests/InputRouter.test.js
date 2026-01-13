
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InputRouter } from '../src/input/InputRouter.js';

describe('InputRouter', () => {
    let router;
    let deps;

    beforeEach(() => {
        deps = {
            focusManager: {
                mode: 'EDITOR',
                previousMode: 'EDITOR',
                setMode: vi.fn(function (mode) {
                    this.previousMode = this.mode;
                    this.mode = mode;
                }),
                toggleBottomBar: vi.fn(),
                toggleOverview: vi.fn(),
                citationUpdateTarget: null
            },
            gutterMode: { handleInput: vi.fn() },
            overviewMode: { handleInput: vi.fn() },
            editorMode: { handleInput: vi.fn() },
            visualSelectMode: { handleInput: vi.fn() },
            renamingMode: { handleInput: vi.fn() }, // NEW
            settingsManager: {
                isOpen: false,
                handleInput: vi.fn(),
                toggle: vi.fn(function () {
                    // Simulate closing logic
                    deps.focusManager.setMode(deps.focusManager.previousMode || 'EDITOR');
                })
            },
            gamepadMenu: {
                isOpen: false,
                handleInput: vi.fn(),
                close: vi.fn(function () {
                    deps.focusManager.setMode(deps.focusManager.previousMode || 'EDITOR');
                })
            },
            bookMenu: {
                isOpen: false,
                handleInput: vi.fn(),
                toggle: vi.fn(function () {
                    deps.focusManager.setMode(deps.focusManager.previousMode || 'EDITOR');
                })
            },
            helpManager: {
                isOpen: false,
                handleInput: vi.fn()
            },
            gridOverview: {
                setLinkTarget: vi.fn(),
                syncInputState: vi.fn()
            },
            gamepadManager: {
                lastStart: false,
                lastSelect: false
            }
        };

        router = new InputRouter(deps);
    });

    const createInput = (buttons = {}) => ({
        buttons: { start: false, select: false, east: false, ...buttons }
    });

    it('should route input to currently active mode', () => {
        deps.focusManager.mode = 'EDITOR';
        router.route(createInput(), {});
        expect(deps.editorMode.handleInput).toHaveBeenCalled();

        deps.focusManager.mode = 'GUTTER';
        router.route(createInput(), {});
        expect(deps.gutterMode.handleInput).toHaveBeenCalled();

        deps.focusManager.mode = 'RENAMING';
        router.route(createInput(), {});
        expect(deps.renamingMode.handleInput).toHaveBeenCalled();
    });

    describe('User Scenario: Basic Gutter Tests', () => {
        it('should cycle EDITOR -> GUTTER -> BOOK_MENU', () => {
            // Starting mode == EDITOR
            deps.focusManager.mode = 'EDITOR';

            // Press start? mode == GUTTER (Gutter)
            // Note: toggleBottomBar is mocked, but we should simulate what it does or mock the implementation?
            // "focusManager.toggleBottomBar" in logic changes mode.
            // But here we mocked it.
            // Better to override mock to actually change mode if we want integration flow.
            deps.focusManager.toggleBottomBar.mockImplementation(function () {
                if (this.mode === 'GUTTER') this.mode = this.previousMode;
                else this.mode = 'GUTTER';
            });

            const startInput = createInput({ start: true });
            router.route(startInput, {});
            expect(deps.focusManager.mode).toBe('GUTTER');

            // Reset start latch (simulated next frame)
            deps.gamepadManager.lastStart = true;
            router.route(createInput({ start: false }), {}); // Release
            deps.gamepadManager.lastStart = false;

            // Press A? mode == BOOK_MENU
            // The router doesn't handle "Press A" for Gutter. GutterMode does.
            // GutterMode logic triggers callbacks.
            // But we are testing InputRouter Transitions.
            // If GutterMode logic is outside Router (as it should be), Router only handles what it sees.
            // User: "Press A? mode == BOOK_MENU"
            // This implies InputRouter doesn't handle this transition. GutterMode does (via callback -> main.js/focusManager change).
            // So this test step is checking Logic OUTSIDE Router?
            // "Transition Testing" implies end-to-end.
            // But GutterMode.handleInput is mocked here.

            // We can manually transition to simulate GutterMode action:
            deps.focusManager.mode = 'BOOK_MENU'; // Simulated action result

            // Closing Gutter/Menu Tests
            // Starting mode == BOOK_MENU (FOCUS: EDITOR implicitly via previousMode)
            deps.focusManager.previousMode = 'EDITOR';

            // Close book menu? (Press Start)
            // Router handles 'Start' in BOOK_MENU to close it.
            router.route(startInput, {});
            // Expect toggle to be called
            expect(deps.bookMenu.toggle).toHaveBeenCalled();
            // Expect mode to revert to previous (EDITOR)
            expect(deps.focusManager.mode).toBe('EDITOR');
        });
    });

    describe('User Scenario: Specific Menu Transitions', () => {
        it('Starting mode == BOOK_MENU (FOCUS: EDITOR) -> Press start -> EDITOR', () => {
            deps.focusManager.mode = 'BOOK_MENU';
            deps.focusManager.previousMode = 'EDITOR';

            router.route(createInput({ start: true }), {});

            expect(deps.bookMenu.toggle).toHaveBeenCalled();
            expect(deps.focusManager.mode).toBe('EDITOR');
        });

        it('Starting mode == BOOK_MENU (FOCUS: OVERVIEW) -> Press start -> OVERVIEW', () => {
            deps.focusManager.mode = 'BOOK_MENU';
            deps.focusManager.previousMode = 'OVERVIEW';

            router.route(createInput({ start: true }), {});

            expect(deps.bookMenu.toggle).toHaveBeenCalled();
            expect(deps.focusManager.mode).toBe('OVERVIEW');
        });
    });

    describe('User Scenario: Focus Switch Tests', () => {
        beforeEach(() => {
            // Implement toggle logic
            deps.focusManager.toggleBottomBar.mockImplementation(function () {
                if (this.mode === 'GUTTER') this.mode = this.previousMode;
                else { this.previousMode = this.mode; this.mode = 'GUTTER'; }
            });
            deps.focusManager.toggleOverview.mockImplementation(function () {
                if (this.mode === 'OVERVIEW') this.mode = 'EDITOR';
                else { this.previousMode = this.mode; this.mode = 'OVERVIEW'; }
            });
        });

        it('should cycle EDITOR -> GUTTER -> EDITOR', () => {
            deps.focusManager.mode = 'EDITOR';

            // Press Start -> GUTTER
            router.route(createInput({ start: true }), {});
            expect(deps.focusManager.mode).toBe('GUTTER');

            // Cleanup Latch
            deps.gamepadManager.lastStart = true;
            router.route(createInput({ start: false }), {});
            deps.gamepadManager.lastStart = false;

            // Press Start -> EDITOR
            router.route(createInput({ start: true }), {});
            expect(deps.focusManager.mode).toBe('EDITOR');
        });

        it('should cycle EDITOR -> OVERVIEW -> GUTTER -> OVERVIEW', () => {
            deps.focusManager.mode = 'EDITOR';

            // Press Select -> OVERVIEW
            router.route(createInput({ select: true }), {});
            expect(deps.focusManager.mode).toBe('OVERVIEW');

            // Cleanup Latch
            deps.gamepadManager.lastSelect = true;
            router.route(createInput({ select: false }), {});
            deps.gamepadManager.lastSelect = false;

            // Press Start -> GUTTER
            router.route(createInput({ start: true }), {});
            expect(deps.focusManager.mode).toBe('GUTTER');
            expect(deps.focusManager.previousMode).toBe('OVERVIEW');

            // Cleanup Latch
            deps.gamepadManager.lastStart = true;
            router.route(createInput({ start: false }), {});
            deps.gamepadManager.lastStart = false;

            // Press Start -> OVERVIEW (Back from Gutter)
            router.route(createInput({ start: true }), {});
            expect(deps.focusManager.mode).toBe('OVERVIEW');
        });
    });

    describe('User Scenario: Other Gutter Menu Tests (Simulated)', () => {
        // These rely on GutterMode logic for "Press left twice and A", which we aren't testing here.
        // We verify that IF mode is SETTINGS_MENU, closing it returns to GUTTER if previousMode was GUTTER.

        it('should return to EDITOR from SETTINGS_MENU if initiated from there (Skip Gutter)', () => {
            deps.focusManager.mode = 'SETTINGS_MENU';
            deps.focusManager.previousMode = 'GUTTER'; // User flow: EDITOR -> GUTTER -> SETTINGS

            // Mock Side Effect of closing Settings: returns to previous mode (GUTTER)
            deps.settingsManager.toggle.mockImplementation(() => {
                deps.focusManager.setMode('GUTTER');
            });

            // Mock Side Effect of toggleBottomBar: returns to Content (EDITOR)
            deps.focusManager.toggleBottomBar.mockImplementation(function () {
                this.mode = 'EDITOR';
            });

            router.route(createInput({ start: true }), {});

            expect(deps.settingsManager.toggle).toHaveBeenCalled();
            expect(deps.focusManager.mode).toBe('EDITOR');
        });
    });
});
