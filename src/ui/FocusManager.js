
export class FocusManager {
    constructor() {
        this.mode = 'EDITOR'; // EDITOR, OVERVIEW, BOTTOM_BAR, DIALOG_CONFIRM, RENAMING, BOOK_MENU, SETTINGS_MENU, GAMEPAD_MENU
        this.previousMode = 'EDITOR';
        this.onChange = null;
    }

    setMode(newMode) {
        if (this.mode === newMode) return;

        this.previousMode = this.mode;
        this.mode = newMode;

        if (this.onChange) this.onChange(this.mode);
        console.log(`Focus changed to: ${this.mode}`);
    }

    toggleOverview() {
        if (this.mode === 'EDITOR') {
            this.setMode('OVERVIEW');
        } else if (this.mode === 'OVERVIEW') {
            this.setMode('EDITOR');
        } else if (this.mode === 'BOTTOM_BAR') {
            // If in bottom bar, where do we go? 
            // Usually back to what lies beneath, or force overview?
            // User spec says: "Pressing select while Book Overview activated -> Editor"
            // It doesn't explicitly handle Bottom Bar -> Select. 
            // Let's assume Select always toggles Editor/Overview stack.
            this.setMode('OVERVIEW');
        }
    }

    toggleBottomBar() {
        if (this.mode === 'BOTTOM_BAR') {
            // Return to previous interaction layer
            this.setMode(this.previousMode === 'BOTTOM_BAR' ? 'EDITOR' : this.previousMode);
        } else {
            this.setMode('BOTTOM_BAR');
        }
    }
}
