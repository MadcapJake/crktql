import { TextEntryMode } from './TextEntryMode.js';

export class EditorMode extends TextEntryMode {
    constructor(deps) {
        super(deps);
        this.bookManager = deps.bookManager;
        this.historyManager = deps.historyManager;
        this.focusManager = deps.focusManager;
        this.gridOverview = deps.gridOverview;
        this.overviewMode = deps.overviewMode;
        this.visualizer = deps.visualizer;
        this.gamepadManager = deps.gamepadManager;
        this.renderer = deps.renderer; // EditorRenderer instance
        this.showNotification = deps.showNotification; // Callback
        this.onVisualSelect = deps.onVisualSelect; // Callback
        this.onPaste = deps.onPaste; // Callback for testing/external handling


        // State
        // lastDpad is handled by super, but EditorMode uses local tracking for now if unrelated?
        // Actually, super.lastDpad exists. We can use it or shadow it. EditorMode writes to this.lastDpad.
        // It's fine to rely on super's property if we initialize it. super handles it.
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
            this.renderIfChanged(this.renderer, part.content, part.cursor, part, this.selectionAnchor);
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
                this.renderIfChanged(this.renderer, part.content, part.cursor, part, this.selectionAnchor);
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
            if (part) this.renderIfChanged(this.renderer, part.content, part.cursor, part, this.selectionAnchor, this.isModifierHeld);

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
        const navLeft = justPressed('left');
        const navRight = justPressed('right');
        // navUp/Down unused in override currently but good to have if needed, or remove.
        // Actually I don't use navUp/Down in the override block below.

        // Base Navigation
        // We pass 'false' for singleLine because EditorMode is multi-line.
        cursor = this.navigate(dpad, cursor, content, false);
        handledNav = cursor !== part.cursor;

        if (this.isModifierHeld) {
            // Override with Word Nav
            if (navLeft) {
                // Word Left: Start of words (including current), punct separate
                let target = part.cursor; // Use original
                const getCat = (i) => {
                    if (i < 0) return 'NONE';
                    const c = content[i];
                    if (/\s/.test(c)) return 'SPACE';
                    if (/\w/.test(c)) return 'WORD';
                    return 'PUNCT';
                };

                if (target > 0) {
                    let i = target - 1;
                    while (i >= 0 && getCat(i) === 'SPACE') i--;
                    if (i >= 0) {
                        const type = getCat(i);
                        while (i >= 0 && getCat(i) === type) i--;
                    }
                    target = i + 1;
                }
                cursor = target;
                handledNav = true;
            } else if (navRight) {
                // Word Right
                let target = part.cursor; // Use original
                const len = content.length;
                const getCat = (i) => {
                    if (i >= len) return 'NONE';
                    const c = content[i];
                    if (/\s/.test(c)) return 'SPACE';
                    if (/\w/.test(c)) return 'WORD';
                    return 'PUNCT';
                };

                if (target < len) {
                    let i = target;
                    while (i < len && getCat(i) === 'SPACE') i++;
                    if (i < len) {
                        const type = getCat(i);
                        while (i < len && getCat(i) === type) i++;
                    }
                    target = i;
                }
                cursor = target;
                handledNav = true;
            }
            // Page Up/Down could go here too if we want overrides
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
                if (this.overviewMode) this.overviewMode.syncInputState(frameInput);
                this.gridOverview.setLinkTarget({ x: tx, y: ty });

                const currentPart = this.bookManager.getCurrentPart();
                if (currentPart) {
                    this.gridOverview.setCursor(currentPart.x, currentPart.y);
                    this.gridOverview.updateView(true);
                }

                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        this.gridOverview.setCursor(tx, ty);
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
            const result = this.processTextChange(
                content,
                cursor,
                state.text,
                this.lastEngineTextLength,
                {
                    historyManager: this.historyManager,
                    partKey: this.bookManager.currentPartKey
                }
            );

            if (result.diff !== 0) {
                if (result.newContent !== content) {
                    this.bookManager.setCurrentPartContent(result.newContent);
                    this.bookManager.setPartCursor(result.newCursor);

                    part.content = result.newContent;
                    part.cursor = result.newCursor;

                    // If atomic or explicit text change, sync engine
                    this.typingEngine.reset(result.newContent);
                    this.lastEngineTextLength = result.newContent.length;
                } else {
                    // Check if length matches what we thought, mostly for safety
                    this.lastEngineTextLength = result.newLength;
                }
            } else {
                this.lastEngineTextLength = result.newLength;
            }

            this.renderIfChanged(this.renderer, part.content, part.cursor, part, this.selectionAnchor);

            // "handledAtomic" check in original was just to avoid overwriting lastLength, but we handled that.
            // visualizer update follows.


            this.visualizer.update(frameInput, state.mode, this.typingEngine.mappings, this.typingEngine.state.syllable);
        }
        this.gamepadManager.lastButtons = { ...frameInput.buttons };
    }

    async paste() {
        if (this.onPaste) {
            this.onPaste();
            return;
        }
        try {
            const text = await navigator.clipboard.readText();
            if (!text) return;

            // Re-fetch state after async await to prevent race condition
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

            this.renderIfChanged(this.renderer, part.content, part.cursor, part, this.selectionAnchor);
            this.typingEngine.reset(newContent);
            this.lastEngineTextLength = newContent.length;

            this.showNotification("Pasted from Clipboard");
        } catch (err) {
            console.error("Paste failed", err);
            this.showNotification("Paste Failed");
        }
    }
}
