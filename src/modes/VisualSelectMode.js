
export class VisualSelectMode {
    constructor(deps) {
        this.bookManager = deps.bookManager;
        this.renderer = deps.renderer;
        this.historyManager = deps.historyManager;
        this.focusManager = deps.focusManager;
        this.typingEngine = deps.typingEngine;
        this.gamepadManager = deps.gamepadManager;
        this.showNotification = deps.showNotification;

        this.anchor = null;
        this.lastDpad = { up: false, down: false, left: false, right: false };
    }

    enter(cursor) {
        this.anchor = cursor;
        this.lastDpad = { up: false, down: false, left: false, right: false };
        this.ignoreMod = true; // Always ignore modifier on first frame/until release

        // Immediate render to show initial state
        const part = this.bookManager.getCurrentPart();
        if (part) {
            this.renderer.render(part, this.anchor);
        }

        // Update Focus and Icon
        this.focusManager.setMode('VISUAL_SELECT');
        this.focusManager.updateModeIcon();
    }

    handleInput(frameInput) {
        const dpad = frameInput.buttons.dpad;
        const part = this.bookManager.getCurrentPart();
        if (!part) return;

        let cursor = part.cursor;
        const content = part.content;
        let navigated = false;

        const isMod = frameInput.buttons.north;
        const jp = (btn) => dpad[btn] && !this.lastDpad[btn];

        // Guard: Ignore modifier if held from entry
        if (this.ignoreMod) {
            if (!isMod) this.ignoreMod = false; // Released, now valid
        }
        const effectiveMod = isMod && !this.ignoreMod;

        if (jp('left')) {
            if (effectiveMod) {
                let target = cursor - 1;
                while (target > 0 && /\s/.test(content[target - 1])) target--; // Skip trailing spaces
                while (target > 0 && !/\s/.test(content[target - 1])) target--; // Skip word
                cursor = target;
            } else {
                // Atomic Left
                const charBefore = content[cursor - 1];
                if (charBefore === '}') {
                    const openBrace = content.lastIndexOf('{{', cursor);
                    if (openBrace !== -1) {
                        cursor = openBrace;
                    } else {
                        cursor = Math.max(0, cursor - 1);
                    }
                } else {
                    cursor = Math.max(0, cursor - 1);
                }
            }
            navigated = true;
        }
        if (jp('right')) {
            if (effectiveMod) {
                let target = cursor;
                while (target < content.length && !/\s/.test(content[target])) target++; // Skip Word
                while (target < content.length && /\s/.test(content[target])) target++; // Skip Spaces
                cursor = target;
            } else {
                // Atomic Right
                if (content.substring(cursor, cursor + 2) === '{{') {
                    const closeBrace = content.indexOf('}}', cursor);
                    if (closeBrace !== -1) {
                        cursor = closeBrace + 2;
                    } else {
                        cursor = Math.min(content.length, cursor + 1);
                    }
                } else {
                    cursor = Math.min(content.length, cursor + 1);
                }
            }
            navigated = true;
        }
        if (jp('up')) {
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
                cursor = 0;
            }
            navigated = true;
        }
        if (jp('down')) {
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
            navigated = true;
        }

        if (navigated) {
            this.bookManager.setPartCursor(cursor);
            part.cursor = cursor;
            this.renderer.render(part, this.anchor);
        }
        this.lastDpad = { ...dpad };

        // Actions
        // A (South) -> Copy
        if (frameInput.buttons.south && !this.gamepadManager.lastButtons.south) {
            const rangeText = this._getSelectionText(part, cursor);
            if (rangeText) {
                navigator.clipboard.writeText(rangeText).catch(e => console.error("Copy failed", e));
                this.showNotification("Copied to Clipboard");
            }
            this._exit();
        }

        // X (West) -> Cut
        if (frameInput.buttons.west && !this.gamepadManager.lastButtons.west) {
            const rangeText = this._getSelectionText(part, cursor);
            if (rangeText) {
                const sStart = Math.min(this.anchor, cursor);
                const sEnd = Math.max(this.anchor, cursor);
                const originalContent = part.content;

                // Sync Cut: Delete immediately
                const newContent = originalContent.slice(0, sStart) + originalContent.slice(sEnd);
                const removedText = originalContent.slice(sStart, sEnd);

                this.historyManager.push({
                    type: 'REMOVE_TEXT',
                    partKey: this.bookManager.currentPartKey,
                    data: {
                        text: removedText,
                        index: sStart
                    }
                });

                this.bookManager.setCurrentPartContent(newContent);
                this.bookManager.setPartCursor(sStart);
                this.typingEngine.reset(newContent);

                navigator.clipboard.writeText(rangeText)
                    .then(() => this.showNotification("Cut to Clipboard"))
                    .catch(e => {
                        console.error("Clipboard Error", e);
                        this.showNotification("Cut locally (Clipboard failed)");
                    })
                    .finally(() => this._exit());
            }
        }

        // B (East) -> Cancel
        if (frameInput.buttons.east && !this.gamepadManager.lastButtons.east) {
            this._exit();
        }

        this.gamepadManager.lastButtons = { ...frameInput.buttons };
    }

    _getSelectionText(part, currentCursor) {
        if (!part || this.anchor === null) return "";
        const start = Math.min(this.anchor, currentCursor);
        const end = Math.max(this.anchor, currentCursor);
        return part.content.slice(start, end);
    }

    _exit() {
        this.anchor = null;
        // Reset inputs on gamepad to prevent fallthrough
        const gp = this.gamepadManager.getActiveGamepad();
        if (gp) this.typingEngine.resetInputState(gp);

        this.focusManager.setMode('EDITOR');
    }
}
