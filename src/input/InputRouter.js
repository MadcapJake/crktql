export class InputRouter {
    constructor(deps) {
        this.deps = deps;
        this.confirmCallback = null;
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
        // Start -> Toggle Bottom Bar (Unless in specific modes)
        const isMenuOpen = ['SETTINGS_MENU', 'GAMEPAD_MENU', 'BOOK_MENU', 'DIALOG_CONFIRM'].includes(focusManager.mode);

        // --- 2. Global Toggles ---
        // Start -> Toggle Bottom Bar (Unless in specific modes)
        if (!isMenuOpen && startPressed && !gamepadManager.lastStart) {
            focusManager.toggleBottomBar();
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
            case 'BOTTOM_BAR':
                gutterMode.handleInput(frameInput);
                break;

            case 'SETTINGS_MENU':
                if (startPressed && !gamepadManager.lastStart) {
                    settingsManager.toggle();
                    focusManager.setMode(focusManager.previousMode || 'EDITOR');
                } else {
                    settingsManager.handleInput(frameInput);
                }
                break;

            case 'GAMEPAD_MENU':
                if (startPressed && !gamepadManager.lastStart) {
                    gamepadMenu.close();
                    focusManager.setMode(focusManager.previousMode || 'EDITOR');
                } else {
                    gamepadMenu.handleInput(frameInput);
                }
                break;

            case 'BOOK_MENU':
                if (startPressed && !gamepadManager.lastStart) {
                    bookMenu.toggle();
                    focusManager.setMode(focusManager.previousMode || 'EDITOR');
                } else {
                    bookMenu.handleInput(frameInput);
                }
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
                if (startPressed && !gamepadManager.lastStart) {
                    if (this.confirmCallback) this.confirmCallback();
                    this.closeConfirmModal();
                }
                // B (East) -> Cancel
                if (frameInput.buttons.east) {
                    this.closeConfirmModal();
                    focusManager.setMode(focusManager.previousMode || 'EDITOR');
                }
                break;

            case 'RENAMING':
                // Typing Input
                if (this.deps.typingEngine) {
                    this.deps.typingEngine.processFrame(gamepad);
                }

                // Save: Start or South (A)
                if ((startPressed && !gamepadManager.lastStart) || (frameInput.buttons.south && !gamepadManager.lastButtons?.south)) {
                    const newName = this.deps.typingEngine.getBufferText();
                    console.log('[Renaming] Committing:', newName);

                    const target = this.deps.focusManager.renameTarget;
                    if (target) {
                        this.deps.bookManager.renamePart(target.oldName, newName);
                        this.deps.gridOverview.render(); // Ensure grid reflects change
                    }

                    this.deps.focusManager.setMode('OVERVIEW');
                }

                // Cancel: Select or East (B)
                if ((selectPressed && !gamepadManager.lastSelect) || (frameInput.buttons.east && !gamepadManager.lastButtons?.east)) {
                    console.log('[Renaming] Cancelled');
                    this.deps.focusManager.setMode('OVERVIEW');
                }
                break;
        }

        gamepadManager.lastStart = startPressed;
        gamepadManager.lastSelect = selectPressed;
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
    }
}
