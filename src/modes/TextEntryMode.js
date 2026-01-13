
export class TextEntryMode {
    constructor(deps) {
        this.typingEngine = deps.typingEngine; // Required
        this.lastRenderedState = null;
        this.lastDpad = { up: false, down: false, left: false, right: false };
    }

    // Standard D-Pad Navigation for single-line or multi-line text
    // Returns new cursor position
    navigate(dpad, currentCursor, content, isSingleLine = false) {
        const justPressed = (btn) => dpad[btn] && !this.lastDpad[btn];
        let cursor = currentCursor;
        const len = content.length;

        if (justPressed('left')) {
            cursor = Math.max(0, cursor - 1);
        }
        if (justPressed('right')) {
            cursor = Math.min(len, cursor + 1);
        }

        if (isSingleLine) {
            // For renaming, Up/Down does nothing or moves to start/end?
            // InputRouter implementation: Up/Down did nothing for Renaming.
        } else {
            // Multi-line logic (from EditorMode)
            if (justPressed('up')) {
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
            }
            if (justPressed('down')) {
                const nextNewline = content.indexOf('\n', cursor);
                if (nextNewline !== -1) {
                    const currentLineStart = content.lastIndexOf('\n', cursor - 1);
                    const col = cursor - (currentLineStart + 1);
                    const nextLineStart = nextNewline + 1;
                    const nextLineEnd = content.indexOf('\n', nextLineStart);
                    const actualEnd = nextLineEnd === -1 ? len : nextLineEnd;
                    const nextLineLen = actualEnd - nextLineStart;
                    const targetCol = Math.min(col, nextLineLen);
                    cursor = nextLineStart + targetCol;
                } else {
                    cursor = len;
                }
            }
        }

        this.lastDpad = { ...dpad };
        return cursor;
    }

    // Shared Optimized Render
    renderIfChanged(renderer, content, cursor, ...renderArgs) {
        if (!renderer) return;

        let changed = false;

        // Check primary state
        if (this.lastRenderedState?.text !== content ||
            this.lastRenderedState?.cursor !== cursor) {
            changed = true;
        }

        // Check auxiliary args (shallow comparison)
        if (!changed) {
            const lastArgs = this.lastRenderedState?.args;
            if (!lastArgs && renderArgs.length > 0) {
                changed = true;
            } else if (lastArgs) {
                if (lastArgs.length !== renderArgs.length) {
                    changed = true;
                } else {
                    for (let i = 0; i < renderArgs.length; i++) {
                        if (renderArgs[i] !== lastArgs[i]) {
                            changed = true;
                            break;
                        }
                    }
                }
            }
        }

        if (changed) {
            if (renderArgs.length > 0) {
                renderer.render(...renderArgs);
            } else {
                renderer.render({ content, cursor });
            }
            this.lastRenderedState = { text: content, cursor, args: renderArgs };
        }
    }

    processTextChange(content, cursor, engineText, lastEngineTextLength, historyContext = null) {
        if (!engineText && engineText !== '') return { newContent: content, newCursor: cursor, newLength: lastEngineTextLength, diff: 0 };

        const diff = engineText.length - lastEngineTextLength;
        let newContent = content;
        let newCursor = cursor;
        let handledAtomic = false;
        let newLength = engineText.length;

        if (diff !== 0) {
            if (diff > 0) {
                // Insertion
                const added = engineText.slice(lastEngineTextLength);
                newContent = content.slice(0, cursor) + added + content.slice(cursor);

                if (historyContext?.historyManager) {
                    historyContext.historyManager.push({
                        type: 'ADD_TEXT',
                        partKey: historyContext.partKey,
                        data: { text: added, index: cursor }
                    });
                }
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

                        if (historyContext?.historyManager) {
                            historyContext.historyManager.push({
                                type: 'REMOVE_CITATION',
                                partKey: historyContext.partKey,
                                data: { text: tag, index: startIdx }
                            });
                        }
                    }
                }

                if (!handledAtomic) {
                    const amount = -diff;
                    const start = Math.max(0, cursor - amount);
                    const removedText = content.slice(start, cursor);

                    if (removedText.length > 0 && historyContext?.historyManager) {
                        historyContext.historyManager.push({
                            type: 'REMOVE_TEXT',
                            partKey: historyContext.partKey,
                            data: { text: removedText, index: start }
                        });
                    }

                    newContent = content.slice(0, start) + content.slice(cursor);
                    newCursor = start;
                }
            }
        } else {
            newLength = lastEngineTextLength;
        }

        return { newContent, newCursor, newLength, handledAtomic, diff };
    }
}
