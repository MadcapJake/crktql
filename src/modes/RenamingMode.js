
import { TextEntryMode } from './TextEntryMode.js';

export class RenamingMode extends TextEntryMode {
    constructor(deps) {
        super(deps);
        this.focusManager = deps.focusManager;
        this.bookManager = deps.bookManager;
        this.historyManager = deps.historyManager;
        this.gridOverview = deps.gridOverview;
        this.overviewMode = deps.overviewMode;
        this.editorRenderer = deps.editorRenderer;
        this.lastEngineTextLength = 0;
        this.wasActive = false;
    }

    activate() {
        // Reset lastLength on activation
        const txt = this.typingEngine.getBufferText();
        this.lastEngineTextLength = txt.length;
        // Ensure cursor is valid?
        if (typeof this.typingEngine.state.cursor === 'undefined') {
            this.typingEngine.state.cursor = txt.length;
        }
        this.wasActive = true;
    }

    handleInput(frameInput, gamepad) {
        if (!this.wasActive) this.activate();

        // Save (B / East)
        if (frameInput.buttons.east && !this.lastDpad.east) {
            this.save(frameInput);
            return;
        }

        // Cancel (Select)
        if (frameInput.buttons.select) {
            this.cancel(frameInput);
            return;
        }

        const dpad = frameInput.buttons.dpad;

        // 1. Get Current State
        const txt = this.typingEngine.getBufferText();
        let cur = this.typingEngine.state.cursor;
        if (typeof cur === 'undefined') cur = txt.length;

        // 2. Navigation (Single Line)
        cur = this.navigate(dpad, cur, txt, true);

        // 3. Sync to Engine (Nav Update)
        this.typingEngine.state.cursor = cur;

        // 4. Process Typing
        const state = this.typingEngine.processFrame(gamepad);

        // 5. Handle Changes via processTextChange
        if (state) {
            const result = this.processTextChange(
                txt,
                cur,
                state.text,
                this.lastEngineTextLength,
                {
                    historyManager: null, // Granular history skipped for Renaming (only Commit history)
                    partKey: null
                }
            );

            if (result.diff !== 0) {
                // Update Engine to match specific cursor logic
                this.typingEngine.reset(result.newContent);
                this.lastEngineTextLength = result.newContent.length;
                this.typingEngine.state.cursor = result.newCursor;

                // Render new state
                this.renderIfChanged(this.editorRenderer, result.newContent, result.newCursor);
            } else {
                this.lastEngineTextLength = result.newLength;
                // Just render current (nav only)
                this.renderIfChanged(this.editorRenderer, state.text, cur);
            }
        } else {
            this.renderIfChanged(this.editorRenderer, txt, cur);
        }
    }

    save(frameInput) {
        const newName = this.typingEngine.getBufferText();
        const { x, y, oldName } = this.focusManager.renameTarget;

        this.bookManager.renamePart(x, y, newName);
        this.bookManager.saveToStorage();

        if (this.historyManager) {
            this.historyManager.push({
                type: 'RENAME_PART',
                partKey: `${x},${y}`,
                data: { x, y, oldName, newName }
            });
        }

        this.exit(frameInput);
    }

    cancel(frameInput) {
        this.exit(frameInput);
    }

    exit(frameInput) {
        this.wasActive = false;
        if (this.overviewMode && frameInput) {
            this.overviewMode.syncInputState(frameInput);
        }

        this.focusManager.setMode('OVERVIEW');
        if (this.gridOverview) this.gridOverview.render();
    }
}
