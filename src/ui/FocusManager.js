
export class FocusManager {
    constructor() {
        this.mode = 'EDITOR'; // EDITOR, OVERVIEW, GUTTER, DIALOG_CONFIRM, RENAMING, BOOK_MENU, SETTINGS_MENU, GAMEPAD_MENU
        this.previousMode = 'EDITOR';
        this.onChange = null;
    }

    setMode(newMode) {
        if (this.mode === newMode) return;

        // Only track previous mode if it's a "Major" mode
        // Don't track menus as history points
        const transientModes = ['BOOK_MENU', 'SETTINGS_MENU', 'GAMEPAD_MENU', 'DIALOG_CONFIRM'];
        if (!transientModes.includes(this.mode)) {
            this.previousMode = this.mode;
        }

        this.mode = newMode;

        if (this.onChange) this.onChange(this.mode);
        console.log(`Focus changed to: ${this.mode}`);
    }

    toggleOverview() {
        if (this.mode === 'EDITOR') {
            this.setMode('OVERVIEW');
        } else if (this.mode === 'OVERVIEW') {
            this.setMode('EDITOR');
        } else if (this.mode === 'GUTTER') {
            // Force Overview
            this.setMode('OVERVIEW');
        }
    }

    toggleBottomBar() {
        if (this.mode === 'GUTTER') {
            // Return to previous interaction layer (Filter out menus)
            const target = ['EDITOR', 'OVERVIEW', 'VISUAL_SELECT'].includes(this.previousMode) ? this.previousMode : 'EDITOR';
            this.setMode(target);
        } else {
            this.setMode('GUTTER');
        }
    }

    setModifierState(isHeld) {
        const modeIcon = document.getElementById('mode-indicator');
        if (modeIcon) {
            if (isHeld) {
                modeIcon.innerHTML = '<i class="fa-solid fa-pause"></i>';
            } else {
                modeIcon.innerHTML = '<i class="fa-solid fa-border-none"></i>';
            }
        }
    }
}
