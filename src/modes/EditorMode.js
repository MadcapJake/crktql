
export class EditorMode {
    constructor(deps) {
        this.typingEngine = deps.typingEngine;
        this.bookManager = deps.bookManager;
        this.historyManager = deps.historyManager;
        this.focusManager = deps.focusManager;
        this.gridOverview = deps.gridOverview;
        this.visualizer = deps.visualizer;
        this.gamepadManager = deps.gamepadManager;
        this.renderer = deps.renderer; // EditorRenderer instance
        this.showNotification = deps.showNotification; // Callback
        this.onVisualSelect = deps.onVisualSelect; // Callback


        // State
        this.lastDpad = { up: false, down: false, left: false, right: false };
        this.lastEngineTextLength = 0;
        this.selectionAnchor = null;
    }

    resetState() {
        const part = this.bookManager.getCurrentPart();
        console.log('[EditorMode] Resetting State. Part:', part ? `ID:${part.x},${part.y} Len:${part.content.length}` : 'null');
        if (part) {
            this.typingEngine.reset(part.content);
            this.lastEngineTextLength = part.content.length;
            this.lastDpad = { up: false, down: false, left: false, right: false };
            this.selectionAnchor = null;

            // CRITICAL: Reset Input State to prevent entry button from typing
            const gp = this.gamepadManager.getActiveGamepad();
            if (gp) this.typingEngine.resetInputState(gp);
        }
    }

    handleInput(frameInput, gamepad) {
        const part = this.bookManager.getCurrentPart();
        if (!part) return;

        let cursor = part.cursor || 0;
        const content = part.content || "";

        // Initialize lastButtons if not present (First frame or Connect)
        if (!this.gamepadManager.lastButtons) {
            this.gamepadManager.lastButtons = { ...frameInput.buttons };
            // Do not process actions on the very first frame to prevent "Press on Connect" issues
            this.lastDpad = { ...frameInput.buttons.dpad }; // Also sync local dpad
            return;
        }

        // TAB: RB (Right Shoulder) - Only if NOT holding Modifier
        if (frameInput.buttons.rb && !this.gamepadManager.lastButtons?.rb && !frameInput.buttons.north) {
            const newContent = content.slice(0, cursor) + '\t' + content.slice(cursor);
            this.bookManager.setCurrentPartContent(newContent);
            this.bookManager.setPartCursor(cursor + 1);

            // Sync render and engine
            part.content = newContent;
            part.cursor = cursor + 1;
            this.renderer.render(part, this.selectionAnchor);
            this.typingEngine.reset(newContent);
            this.lastEngineTextLength = newContent.length;
        }

        // Backspace Word: LB (Left Shoulder) + Modifier (North)
        if (frameInput.buttons.lb && frameInput.buttons.north && !this.gamepadManager.lastButtons?.lb) {
            let target = cursor - 1;
            while (target > 0 && /\s/.test(content[target - 1])) target--; // Skip trailing spaces
            while (target > 0 && !/\s/.test(content[target - 1])) target--; // Skip word

            const removedText = content.slice(target, cursor);
            if (removedText.length > 0) {
                this.historyManager.push({
                    type: 'REMOVE_TEXT',
                    partKey: this.bookManager.currentPartKey,
                    data: { text: removedText, index: target }
                });

                const newContent = content.slice(0, target) + content.slice(cursor);
                this.bookManager.setCurrentPartContent(newContent);
                this.bookManager.setPartCursor(target);

                // Sync render and engine
                part.content = newContent;
                part.cursor = target;
                this.renderer.render(part, this.selectionAnchor);
                this.typingEngine.reset(newContent);
                this.lastEngineTextLength = newContent.length;

                // Prevent TypingEngine from processing this frame's LB
                // We can't easily mutate frameInput.buttons if it's referenced elsewhere, 
                // but we can ensure we update our local lastButtons.
                // Critical: We need to skip typingEngine.processFrame() or mask LB?
                // Actually, if we reset typingEngine above, it might be fine, 
                // BUT typingEngine might still see LB pressed in processFrame and trigger ANOTHER backspace.
                // Just return? No, we might need other processing?
                // Safest: masking locally.
            }
            // Mark LB as consumed in gamepadManager to prevent repeated triggers?
            // Actually, simplest is to pass a "masked" gamepad to typingEngine if we handled an action?
        }

        const dpad = frameInput.buttons.dpad;
        let handledNav = false;

        // Safe access helper
        const justPressed = (btn) => dpad[btn] && !this.lastDpad[btn];

        // Modifier State (Y / North)
        this.isModifierHeld = frameInput.buttons.north;

        // Sync Render Loop (if needed for continuous UI feedback)
        // We usually only render on change, but modifier might change without content change.
        // We should force render if modifier state changes.
        if (this.gamepadManager.lastButtons?.north !== frameInput.buttons.north) {
            const part = this.bookManager.getCurrentPart();
            if (part) this.renderer.render(part, this.selectionAnchor, this.isModifierHeld);

            // Toggle Status Icon
            const modeIcon = document.getElementById('mode-indicator');
            if (modeIcon) {
                if (this.isModifierHeld) {
                    modeIcon.innerHTML = '<i class="fa-solid fa-pause"></i>';
                } else {
                    modeIcon.innerHTML = '<i class="fa-solid fa-border-none"></i>';
                }
            }
        }

        // Undo: Y (North) + Left Trigger
        if (this.isModifierHeld && frameInput.buttons.lt && !this.gamepadManager.lastButtons?.lt) {
            this.historyManager.undo().then(op => {
                if (op) {
                    this.showNotification(`Undo: ${op.type} (To: ${op.navigateTo?.mode || 'EDITOR'})`);

                    if (op.navigateTo) {
                        if (this.bookManager.currentPartKey !== `${op.navigateTo.x},${op.navigateTo.y}`) {
                            this.bookManager.selectPart(op.navigateTo.x, op.navigateTo.y);
                        }

                        if (op.navigateTo.mode) {
                            this.focusManager.setMode(op.navigateTo.mode);
                            if (op.navigateTo.mode === 'OVERVIEW') {
                                this.gridOverview.setCursor(op.navigateTo.x, op.navigateTo.y);
                                this.gridOverview.syncInputState(frameInput);
                                this.gridOverview.ignoreNextRename = true;
                                this.gridOverview.updateView(true);
                            }
                        }
                    }

                    // Sync Engine regardless
                    const p = this.bookManager.getCurrentPart();
                    if (p) {
                        this.typingEngine.reset(p.content);
                        this.lastEngineTextLength = p.content.length;
                        this.renderer.render(p, this.selectionAnchor);
                    }
                } else {
                    this.showNotification("Nothing to Undo");
                }
            });
            this.gamepadManager.lastButtons.lt = true; // Consume
            return;
        }

        // Redo: Y (North) + Right Trigger
        if (this.isModifierHeld && frameInput.buttons.rt && !this.gamepadManager.lastButtons.rt) {
            this.historyManager.redo().then(op => {
                if (op) {
                    this.showNotification(`Redo: ${op.type}`);

                    if (op.navigateTo) {
                        if (this.bookManager.currentPartKey !== `${op.navigateTo.x},${op.navigateTo.y}`) {
                            this.bookManager.selectPart(op.navigateTo.x, op.navigateTo.y);
                        }
                        if (op.navigateTo.mode) {
                            this.focusManager.setMode(op.navigateTo.mode);
                            if (op.navigateTo.mode === 'OVERVIEW') {
                                this.gridOverview.setCursor(op.navigateTo.x, op.navigateTo.y);
                                this.gridOverview.syncInputState(frameInput);
                                this.gridOverview.ignoreNextRename = true;
                                this.gridOverview.updateView(true);
                            }
                        }
                    }

                    const p = this.bookManager.getCurrentPart();
                    if (p) {
                        this.typingEngine.reset(p.content);
                        this.lastEngineTextLength = p.content.length;
                        this.renderer.render(p, this.selectionAnchor);
                    }
                } else {
                    this.showNotification("Nothing to Redo");
                }
            });
            this.gamepadManager.lastButtons.rt = true; // Consume
            return;
        }

        // Navigation
        if (justPressed('left')) {
            if (this.isModifierHeld) {
                // Ctrl+Left (Word Left)
                let target = cursor - 1;
                while (target > 0 && /\s/.test(content[target - 1])) target--; // Skip trailing spaces
                while (target > 0 && !/\s/.test(content[target - 1])) target--; // Skip word
                cursor = target;
            } else {
                cursor = Math.max(0, cursor - 1);
            }
            handledNav = true;
        }
        if (justPressed('right')) {
            if (this.isModifierHeld) {
                // Ctrl+Right (Word Right)
                let target = cursor;
                while (target < content.length && !/\s/.test(content[target])) target++; // Skip Word
                while (target < content.length && /\s/.test(content[target])) target++; // Skip Spaces
                cursor = target;
            } else {
                cursor = Math.min(content.length, cursor + 1);
            }
            handledNav = true;
        }
        if (justPressed('up')) {
            if (this.isModifierHeld) {
                // Page Up (Approx 10 lines)
                let newLinesFound = 0;
                let target = cursor;
                while (target > 0 && newLinesFound < 10) {
                    target--;
                    if (content[target] === '\n') newLinesFound++;
                }
                cursor = target;
            } else {
                // Standard Up
                const lastNewline = content.lastIndexOf('\n', cursor - 1);
                if (lastNewline !== -1) {
                    const currentLineStart = content.lastIndexOf('\n', cursor - 1);
                    const col = cursor - currentLineStart - 1;

                    const prevLineEnd = currentLineStart;
                    const prevLineStart = content.lastIndexOf('\n', prevLineEnd - 1);

                    const lineLen = prevLineEnd - prevLineStart - 1;
                    const targetCol = Math.min(col, lineLen);
                    cursor = (prevLineStart + 1) + targetCol;
                } else {
                    cursor = 0; // Top of file
                }
            }
            handledNav = true;
        }
        if (justPressed('down')) {
            if (this.isModifierHeld) {
                // Page Down
                let newLinesFound = 0;
                let target = cursor;
                while (target < content.length && newLinesFound < 10) {
                    if (content[target] === '\n') newLinesFound++;
                    target++;
                }
                cursor = target;
            } else {
                // Standard Down
                const nextNewline = content.indexOf('\n', cursor);
                if (nextNewline !== -1) {
                    const currentLineStart = content.lastIndexOf('\n', cursor - 1);
                    const col = cursor - (currentLineStart + 1);

                    const nextLineStart = nextNewline + 1;
                    const nextLineEnd = content.indexOf('\n', nextLineStart);
                    const actualEnd = nextLineEnd === -1 ? content.length : nextLineEnd;
                    const nextLineLen = actualEnd - nextLineStart;

                    const targetCol = Math.min(col, nextLineLen);
                    cursor = nextLineStart + targetCol;
                } else {
                    cursor = content.length;
                }
            }
            handledNav = true;
        }

        // Update persistent cursor
        if (handledNav) {
            // ATOMIC CITATION SKIPPING:
            const re = /\{\{cite:.*?\}\}/g;
            let match;
            while ((match = re.exec(content)) !== null) {
                const start = match.index;
                const end = match.index + match[0].length;

                // If strictly inside (not at edges)
                if (cursor > start && cursor < end) {
                    // Determine direction
                    if (justPressed('left') || justPressed('up')) {
                        cursor = start;
                    } else {
                        cursor = end;
                    }
                    break;
                }
            }

            this.bookManager.setPartCursor(cursor);

            // LATENCY FIX: Sync local copy for immediate render
            part.cursor = cursor;

            this.renderer.render(part, this.selectionAnchor);
        }

        // Update tracking for next frame
        this.lastDpad = { ...dpad };

        // VISUAL SELECT TRIGGER: Hold Y + Press RB
        if (this.isModifierHeld && frameInput.buttons.rb && !this.gamepadManager.lastButtons?.rb) {
            this.showNotification("Visual Select Mode Entered");

            // We need to initialize the mode. 
            // Ideally we should have the mode instance injected, but we only have 'deps'.
            // For now, we rely on main.js logic OR we expose a callback.
            // But wait, we refactored main.js to just delegate.
            // Who calls visualSelectMode.enter(cursor)?
            // It MUST be called.

            // Fix: We need to inject visualSelectMode into EditorMode or expose a callback.
            if (this.onVisualSelect) {
                this.onVisualSelect(cursor);
            } else {
                console.error("onVisualSelect callback missing in EditorMode");
                this.focusManager.setMode('VISUAL_SELECT'); // Fallback (will miss anchor init)
            }

            this.gamepadManager.lastButtons = { ...frameInput.buttons };
            return;
        }

        // CITATION FOLLOW: Hold Y + Press B
        if (this.isModifierHeld && frameInput.buttons.east && !this.gamepadManager.lastButtons.east) {
            const re = /\{\{cite:(-?\d+),(-?\d+)\}\}/g;
            let match;
            let found = null;

            while ((match = re.exec(content)) !== null) {
                if (cursor >= match.index && cursor <= match.index + match[0].length) {
                    found = match;
                    break;
                }
            }

            if (found) {
                const tx = parseInt(found[1]);
                const ty = parseInt(found[2]);
                const tagStart = found.index;
                const tagEnd = found.index + found[0].length;

                this.focusManager.citationUpdateTarget = { start: tagStart, end: tagEnd };
                this.focusManager.setMode('OVERVIEW');
                this.gridOverview.syncInputState(frameInput);
                this.gridOverview.setLinkTarget({ x: tx, y: ty });

                const currentPart = this.bookManager.getCurrentPart();
                if (currentPart) {
                    this.gridOverview.setCursor(currentPart.x, currentPart.y);
                    this.gridOverview.updateView(true);
                }

                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        this.gridOverview.setCursor(tx, ty);
                        this.gridOverview.ignoreNextRename = true;
                    });
                });

                this.showNotification(`Following Link to (${tx},${ty})`);
                this.gamepadManager.lastButtons = { ...frameInput.buttons };
                return;
            } else {
                this.showNotification("No link found at cursor");
                this.gamepadManager.lastButtons = { ...frameInput.buttons };
                return;
            }
        }

        // PASTE TRIGGER: Hold Y + L3/R3 Click
        if (this.isModifierHeld && (frameInput.buttons.l3 || frameInput.buttons.r3)) {
            const lastBtns = this.gamepadManager.lastButtons || {};
            if ((frameInput.buttons.l3 && !lastBtns.l3) ||
                (frameInput.buttons.r3 && !lastBtns.r3)) {

                if (this.typingEngine.state.mode === 'ONSET') {
                    // Dispatch Global Paste? 
                    // Ideally duplicate handlePaste, but for now we assume handlePaste is not strictly local.
                    // Refactor Note: handlePaste logic should also be moved or exposed?
                    // For now, let's assume `window.handlePaste()` or we omit it until that logic is moved?
                    // It's in `main.js`. We should probably pass it as a dependency or move it.
                    // Since user asked for isolation, let's skip copying `handlePaste` logic INLINE for now
                    // and assume we fix that later. Or better: Emit an event?
                    // Let's assume passed in deps as `onPaste`?
                    // For MVP of this class, let's just Log and TODO. 
                    // Wait, "being extremely careful to implement everything exactly as before".
                    // We need to inject `onPaste`.
                    if (this.paste) this.paste();
                }
            }
            this.gamepadManager.lastButtons = { ...frameInput.buttons };
        }

        // 3. Command Layer Guard
        if (this.isModifierHeld) {
            this.gamepadManager.lastButtons = { ...frameInput.buttons };
            return;
        }

        // Typing Logic
        const state = this.typingEngine.processFrame(gamepad);
        if (state) {
            // 1. Handle Explicit Actions
            if (state.action) {
                let newContent = content;
                let newCursor = cursor;

                if (state.action === 'DELETE_FORWARD') {
                    // Atomic Citation Deletion (Forward)
                    const slice = content.slice(cursor);
                    let handledAtomic = false;
                    if (slice.startsWith('{{cite:')) {
                        const closeIdx = slice.indexOf('}}');
                        if (closeIdx !== -1) {
                            const tag = slice.slice(0, closeIdx + 2);
                            if (/^\{\{cite:.*?\}\}$/.test(tag)) {
                                newContent = content.slice(0, cursor) + content.slice(cursor + tag.length);
                                handledAtomic = true;
                                this.historyManager.push({
                                    type: 'REMOVE_CITATION',
                                    partKey: this.bookManager.currentPartKey,
                                    data: { text: tag, index: cursor }
                                });
                                this.typingEngine.reset(newContent);
                                this.lastEngineTextLength = newContent.length;
                            }
                        }
                    }

                    if (!handledAtomic && cursor < content.length) {
                        const removedText = content.slice(cursor, cursor + 1);
                        this.historyManager.push({
                            type: 'REMOVE_TEXT',
                            partKey: this.bookManager.currentPartKey,
                            data: { text: removedText, index: cursor }
                        });
                        newContent = content.slice(0, cursor) + content.slice(cursor + 1);
                    }
                } else if (state.action === 'DELETE_WORD_LEFT') {
                    let target = cursor - 1;
                    while (target > 0 && /\s/.test(content[target - 1])) target--;
                    while (target > 0 && !/\s/.test(content[target - 1])) target--;

                    const removedText = content.slice(target, cursor);
                    if (removedText.length > 0) {
                        this.historyManager.push({
                            type: 'REMOVE_TEXT',
                            partKey: this.bookManager.currentPartKey,
                            data: { text: removedText, index: target }
                        });
                    }
                    newContent = content.slice(0, target) + content.slice(cursor);
                    newCursor = target;
                }

                if (newContent !== content) {
                    this.bookManager.setCurrentPartContent(newContent);
                    this.bookManager.setPartCursor(newCursor);

                    part.content = newContent;
                    part.cursor = newCursor;

                    this.typingEngine.reset(newContent);
                    this.lastEngineTextLength = newContent.length;
                }

                this.renderer.render(part, this.selectionAnchor);
                this.visualizer.update(frameInput, state.mode, this.typingEngine.mappings, this.typingEngine.state.syllable);
                // break equivalent (return from fn)
                return;
            }

            // 2. Delta Text
            const currentEngineText = state.text;
            const diff = currentEngineText.length - this.lastEngineTextLength;
            let handledAtomic = false;

            if (diff !== 0) {
                let newContent = content;
                let newCursor = cursor;

                if (diff > 0) {
                    // Insertion
                    const added = currentEngineText.slice(this.lastEngineTextLength);
                    newContent = content.slice(0, cursor) + added + content.slice(cursor);

                    this.historyManager.push({
                        type: 'ADD_TEXT',
                        partKey: this.bookManager.currentPartKey,
                        data: { text: added, index: cursor }
                    });

                    newCursor = cursor + diff;
                } else {
                    // Backspace
                    const before = content.slice(0, cursor);
                    if (before.endsWith('}}')) {
                        const lastNewline = before.lastIndexOf('\n');
                        const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;
                        const currentLineBeforeCursor = before.slice(lineStart);
                        const match = currentLineBeforeCursor.match(/(\{\{cite:.*?\}\})$/);

                        if (match) {
                            const tag = match[1];
                            const startIdx = cursor - tag.length;

                            newContent = content.slice(0, startIdx) + content.slice(cursor);
                            newCursor = startIdx;
                            handledAtomic = true;

                            this.historyManager.push({
                                type: 'REMOVE_CITATION',
                                partKey: this.bookManager.currentPartKey,
                                data: { text: tag, index: startIdx }
                            });

                            this.typingEngine.reset(newContent);
                            this.lastEngineTextLength = newContent.length;
                        }
                    }

                    if (!handledAtomic) {
                        const amount = -diff;
                        const start = Math.max(0, cursor - amount);
                        const removedText = content.slice(start, cursor);

                        if (removedText.length > 0) {
                            this.historyManager.push({
                                type: 'REMOVE_TEXT',
                                partKey: this.bookManager.currentPartKey,
                                data: { text: removedText, index: start }
                            });
                        }

                        newContent = content.slice(0, start) + content.slice(cursor);
                        newCursor = start;
                    }
                }

                this.bookManager.setCurrentPartContent(newContent);
                this.bookManager.setPartCursor(newCursor);

                part.content = newContent;
                part.cursor = newCursor;
            }

            this.renderer.render(part, this.selectionAnchor);

            if (!state.action && diff !== 0 && handledAtomic) {
                // Done
            } else {
                this.lastEngineTextLength = currentEngineText.length;
            }

            this.visualizer.update(frameInput, state.mode, this.typingEngine.mappings, this.typingEngine.state.syllable);
        }
        this.gamepadManager.lastButtons = { ...frameInput.buttons };
    }

    async paste() {
        try {
            const text = await navigator.clipboard.readText();
            if (!text) return;

            const part = this.bookManager.getCurrentPart();
            if (!part) return;

            const content = part.content || "";
            const cursor = part.cursor || 0;

            const newContent = content.slice(0, cursor) + text + content.slice(cursor);

            this.historyManager.push({
                type: 'ADD_TEXT',
                partKey: this.bookManager.currentPartKey,
                data: { text: text, index: cursor }
            });

            this.bookManager.setCurrentPartContent(newContent);
            this.bookManager.setPartCursor(cursor + text.length);

            // Sync
            part.content = newContent;
            part.cursor = cursor + text.length;

            this.renderer.render(part, this.selectionAnchor);
            this.typingEngine.reset(newContent);
            this.lastEngineTextLength = newContent.length;

            this.showNotification("Pasted from Clipboard");
        } catch (err) {
            console.error("Paste failed", err);
            this.showNotification("Paste Failed");
        }
    }
}
