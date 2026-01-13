
export class GutterMode {
    constructor(deps) {
        this.gutter = deps.gutter; // UI Renderer (formerly NavigationBar)

        // State
        this.selectedIndex = 0;

        // Input Tracking
        this.lastNav = { left: false, right: false };
        this.lastAction = false;
    }

    activate() {
        // Reset to default? Or keep state?
        // NavigationBar defaulted to Book Menu (last item) or Open Book.
        // Let's ask Gutter what the default is, or set logic here.
        // NavigationBar.js had: `if (openIdx !== -1) { this.selectedIndex = openIdx; }`
        // We'll reimplement that logic here.
        // Items are hardcoded in View currently. Let's assume we sync.

        // Actually, let's just default to last index (Book Menu) as requested in previous task?
        // Task said "Default Bottom Bar selection to 'Book Menu' (Far Right)".

        const count = this.gutter.getItemCount();
        this.selectedIndex = count - 1;

        this.gutter.activate();
        this.syncView();
    }

    deactivate() {
        this.gutter.deactivate();
    }

    handleInput(input) {
        if (!input) return;

        const dpad = input.buttons.dpad;
        const buttons = input.buttons;

        // Navigation: D-Pad OR Shoulder Buttons
        const leftInput = dpad.left || buttons.lb;
        const rightInput = dpad.right || buttons.rb;

        const count = this.gutter.getItemCount();

        if (rightInput && !this.lastNav.right) {
            this.selectedIndex = (this.selectedIndex + 1) % count;
            this.syncView();
        }
        if (leftInput && !this.lastNav.left) {
            this.selectedIndex = (this.selectedIndex - 1 + count) % count;
            this.syncView();
        }

        // Action (A button / South)
        const actionPressed = buttons.south;
        if (actionPressed && !this.lastAction) {
            this.triggerAction(input);
        }

        this.lastNav = { left: leftInput, right: rightInput };
        this.lastAction = actionPressed;
    }

    syncInputState(input) {
        if (!input || !input.buttons) return;
        const dpad = input.buttons.dpad || {};
        const buttons = input.buttons;

        this.lastNav = {
            left: dpad.left || buttons.lb,
            right: dpad.right || buttons.rb
        };
        this.lastAction = buttons.south;
    }

    syncView() {
        this.gutter.setSelectedIndex(this.selectedIndex);
    }

    triggerAction(input) {
        // We need to know the Item ID or Type.
        // View knows ID. Controller knows Index.
        // Ask View to trigger? Or ask View for ID?
        // "Separation of Concerns": Controller shouldn't know DOM IDs?
        // But Controller decides WHAT to do.
        // We'll delegate action execution to View for now, but pass Input payload.
        this.gutter.triggerAction(this.selectedIndex, input);
    }
}
