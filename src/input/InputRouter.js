export class InputRouter {
    constructor(deps) {
        this.deps = deps;
        this.confirmCallback = null;
        this.lastRenamingState = null;
    }

    route(frameInput, gamepad) {
        const { focusManager, gutterMode, overviewMode, editorMode, visualSelectMode, settingsManager, gamepadMenu, bookMenu, helpManager, gridOverview, gamepadManager } = this.deps;

        const startPressed = frameInput.buttons.start;
        const selectPressed = frameInput.buttons.select;

        // --- 1. Priority Overlays ---
        // (Calibration is handled before calling router in main loop, or should be here?)
        // Main loop line 750 handled calibration. We can leave it there as "System Level".
        // Router handles Application Level.

        // Help Menu
        if (helpManager.isOpen) {
            helpManager.handleInput(frameInput);
            return; // Only time we return early? Or should we just let state switch handle it?
            // Existing logic returned.
        }

        // --- 2. Global Toggles ---

        // Start -> Universal Toggle / Back / Cancel
        if (startPressed && !gamepadManager.lastStart) {
            if (focusManager.mode === 'GUTTER') {
                focusManager.toggleBottomBar(); // Returns to main content
            }
            else if (['EDITOR', 'OVERVIEW', 'VISUAL_SELECT', 'RENAMING'].includes(focusManager.mode)) {
                focusManager.setMode('GUTTER');
            }
            else {
                // Menus & Dialogs: Treat Start as "Cancel/Close"
                if (focusManager.mode === 'BOOK_MENU') bookMenu.toggle();
                else if (focusManager.mode === 'SETTINGS_MENU') settingsManager.toggle();
                else if (focusManager.mode === 'GAMEPAD_MENU') gamepadMenu.close();
                else if (focusManager.mode === 'DIALOG_CONFIRM') this.closeConfirmModal();

                // CRITICAL: Ensure we land on CONTENT (Editor/Overview), not GUTTER.
                // If the close/toggle logic reverted us to GUTTER (because previousMode was GUTTER),
                // we must override this to fulfill "Start -> Content" user rule.
                if (focusManager.mode === 'GUTTER') {
                    // Toggle Bottom Bar takes us from Gutter -> Content
                    focusManager.toggleBottomBar();
                }
            }
        }


        // Select -> Toggle Overview
        if (focusManager.mode !== 'DIALOG_CONFIRM' && focusManager.mode !== 'RENAMING' && selectPressed && !gamepadManager.lastSelect) {
            if (focusManager.mode === 'OVERVIEW') {
                // Reset Targets
                focusManager.citationUpdateTarget = null;
                gridOverview.setLinkTarget(null);
            }
            focusManager.toggleOverview();
            if (focusManager.mode === 'OVERVIEW') {
                // gridOverview.syncInputState(frameInput);
            }
        }

        // --- 3. Mode Switching ---
        switch (focusManager.mode) {
            case 'GUTTER':
                gutterMode.handleInput(frameInput);
                break;

            case 'SETTINGS_MENU':
                settingsManager.handleInput(frameInput);
                break;

            case 'GAMEPAD_MENU':
                gamepadMenu.handleInput(frameInput);
                break;

            case 'BOOK_MENU':
                bookMenu.handleInput(frameInput);
                break;

            case 'OVERVIEW':
                overviewMode.handleInput(frameInput);
                break;

            case 'EDITOR':
                editorMode.handleInput(frameInput, gamepad);
                break;

            case 'VISUAL_SELECT':
                visualSelectMode.handleInput(frameInput);
                break;

            case 'DIALOG_CONFIRM':
                // B (East) -> Confirm
                if (frameInput.buttons.east) { // Was Cancel, now Confirm
                    if (this.confirmCallback) this.confirmCallback();
                    this.closeConfirmModal();
                }
                // Start -> Cancel (Handled by Global Logic above)
                break;

            case 'RENAMING':
                this.handleRenaming(frameInput, gamepad);
                break;
        }

        gamepadManager.lastStart = startPressed;
        gamepadManager.lastSelect = selectPressed;
    }

    handleRenaming(frameInput, gamepad) {
        if (this.deps.renamingMode) {
            this.deps.renamingMode.handleInput(frameInput, gamepad);
        } else {
            console.error("RenamingMode dependency missing in InputRouter");
        }
    }

    requestConfirm(message, callback) {
        const modal = document.getElementById('confirm-modal');
        const msgEl = document.getElementById('confirm-message');
        if (modal && msgEl) {
            msgEl.textContent = message;
            modal.style.display = 'flex';
            this.confirmCallback = callback;
            this.deps.focusManager.setMode('DIALOG_CONFIRM');
        }
    }

    closeConfirmModal() {
        const modal = document.getElementById('confirm-modal');
        if (modal) modal.style.display = 'none';
        this.confirmCallback = null;

        // Restore Mode (Default to Editor if unknown)
        const target = this.deps.focusManager.previousMode || 'EDITOR';
        this.deps.focusManager.setMode(target);
    }
}
