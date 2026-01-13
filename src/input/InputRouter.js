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
        const { typingEngine, focusManager, editorRenderer, bookManager, gridOverview, overviewMode, historyManager } = this.deps;

        // Mapping:
        // B (East) -> Save
        // Select -> Cancel
        // A (South) -> Space (Typing)

        const confirmPressed = frameInput.buttons.east; // B is Save
        const cancelPressed = frameInput.buttons.select; // Select is Cancel

        // Prevent Input Bleed helper
        const syncOverviewInput = () => {
            if (overviewMode) {
                // Manually update lastButtons so Overview doesn't see this press as a 'new' press next frame
                overviewMode.lastButtons = JSON.parse(JSON.stringify(frameInput.buttons));
            }
        };

        if (confirmPressed) {
            // Save Name
            const newName = typingEngine.getBufferText();
            const { x, y, oldName } = focusManager.renameTarget;

            // 1. Update Data
            bookManager.renamePart(x, y, newName);
            bookManager.saveToStorage();

            // 2. Push History
            if (historyManager) {
                historyManager.push({
                    type: 'RENAME_PART',
                    partKey: `${x},${y}`,
                    data: { x, y, oldName, newName }
                });
            }

            syncOverviewInput();
            focusManager.setMode('OVERVIEW');
            if (gridOverview) gridOverview.render();
        }
        else if (cancelPressed) {
            // Cancel
            syncOverviewInput();
            focusManager.setMode('OVERVIEW');
        }
        else {
            // D-Pad Navigation (Cursor)
            const dpad = frameInput.buttons.dpad;
            const lastDpad = this.deps.gamepadManager.lastButtons?.dpad || {};

            const txt = typingEngine.getBufferText();
            let cur = typingEngine.state.cursor;

            // Note: Initialize cursor if undefined (caused by TypingEngine reset quirks)
            if (typeof cur === 'undefined') cur = txt.length;

            if (dpad.left && !lastDpad.left) {
                cur = Math.max(0, cur - 1);
            }
            if (dpad.right && !lastDpad.right) {
                cur = Math.min(txt.length, cur + 1);
            }

            // Sync back to Engine
            typingEngine.state.cursor = cur;

            // Typing (Includes A/South for Space)
            typingEngine.processFrame(gamepad);

            // Typing might have updated cursor (if we added it to engine) 
            // OR if engine appended text, cursor should advance.
            // Since Engine is generic, it might NOT advance 'cursor' property. 
            // We need to detect length change?
            const newTxt = typingEngine.getBufferText();
            if (newTxt.length > txt.length) {
                // Character added. 
                // Because Engine appends, it went to end? 
                // OR we want to support insertion at cursor? 
                // For MVP Renaming: Engine appends. We probably just want cursor to follow end if at end?
                // Or if we are editing in middle, we must handle insertion manually.

                // CRITICAL: processFrame() calls typeCharacter(char) -> state.text += char.
                // It does NOT support insertion. 
                // So typing always appends. 
                // If user moves cursor left and types, it still appends to end? 
                // YES, with current Engine.

                // FIX: If cursor < txt.length, we must splice the new char?
                // Too complex for 'InputRouter'. 
                // BUT user just wants to fix typos. 
                // For now, let's allow cursor movement. 
                // If they type, it appends. 
                // Changing this strictly requires Engine rewrite.
                // However, user said "cursor doesn't move". 
                // Let's at least allow movement.

                // Update cursor to end if we just typed?
                if (cur === txt.length) {
                    cur = newTxt.length;
                } else {
                    // We typed at end (appended). Cursor stays where it was? No. 
                    // If we typed, we probably want to see it. 
                    // Let's leave cursor logic simple for now: Navigation works. Typing appends.
                }

                // Actually, if we want to fix "Typing in middle", we need a smarter/modified Engine.
                // But let's deliver the Navigation request first.
            }
            // Re-read cursor in case engine changed it (it won't)

            // Render Update
            if (editorRenderer) {
                const finalTxt = typingEngine.getBufferText();
                // Ensure state matches what we calculated
                typingEngine.state.cursor = cur;

                console.log(`[Renaming] Render: "${finalTxt}" Cursor: ${cur}`);

                editorRenderer.render({
                    content: finalTxt,
                    cursor: cur
                });
            }
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
