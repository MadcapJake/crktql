
export class NavigationBar {
    constructor(elementId, config) {
        this.container = document.getElementById(elementId);
        this.config = config || {};

        // Define items (order matches UI)
        // Export | Settings | New | Save | Open
        this.items = [
            'export-logs-btn',
            'gamepad-btn',
            'settings-btn',
            'help-btn',
            'book-menu-btn'
        ];

        this.selectedIndex = 0;
        this.isActive = false;

        this.lastNav = { left: false, right: false };
        this.lastAction = false; // A button
    }

    activate() {
        this.isActive = true;
        // Default to "Open Book" (Index 4)
        const openIdx = this.items.indexOf('open-book-btn');
        if (openIdx !== -1) {
            this.selectedIndex = openIdx;
        }
        this.render();
    }

    deactivate() {
        this.isActive = false;
        this.render();
    }

    handleInput(input) {
        if (!this.isActive || !input) return;

        const dpad = input.buttons.dpad;

        // Navigation: D-Pad OR Shoulder Buttons
        const leftInput = dpad.left || input.buttons.lb;
        const rightInput = dpad.right || input.buttons.rb;

        if (rightInput && !this.lastNav.right) {
            this.selectedIndex = (this.selectedIndex + 1) % this.items.length;
            this.render();
        }
        if (leftInput && !this.lastNav.left) {
            this.selectedIndex = (this.selectedIndex - 1 + this.items.length) % this.items.length;
            this.render();
        }

        // Action (A button / South)
        const actionPressed = input.buttons.south;
        if (actionPressed && !this.lastAction) {
            this.triggerAction(this.items[this.selectedIndex], input);
        }

        this.lastNav = { left: leftInput, right: rightInput };
        this.lastAction = actionPressed;
    }

    triggerAction(id, input) {
        const el = document.getElementById(id);
        if (el) {
            // Dispatch a custom event or just click?
            // If click processing needs the input data (like HelpManager), we should attach it or call a specific handler.
            // Hack: Attach input to the element briefly? Or use custom event.
            // Simpler: Special case for help?
            // "Elegant": el.dispatchEvent(new CustomEvent('nav-click', { detail: { input } }));

            // Let's stick to click for now, but if it's the help button, we might need a direct call if we can't pass args through click.
            // Actually, main.js listens to 'click'. Click doesn't carry gamepad data.

            if (id === 'help-btn') {
                // We need to access helpManager directly or emit event the main loop handles.
                // Let's emit a global event that main.js listens to instead of click?
                // OR: dispatch 'request-help-toggle'
                window.dispatchEvent(new CustomEvent('request-help-toggle', { detail: { input } }));
            } else if (id === 'book-menu-btn') {
                window.dispatchEvent(new CustomEvent('request-book-menu-toggle', { detail: { input } }));
            } else {
                el.click();
            }
        }
    }

    render() {
        if (!this.container) return;

        // Toggle visual active state of the bar itself if needed
        if (this.isActive) {
            this.container.classList.add('nav-active');
        } else {
            this.container.classList.remove('nav-active');
        }

        // Update highlight
        this.items.forEach((id, idx) => {
            const el = document.getElementById(id);
            if (!el) return;

            if (this.isActive && idx === this.selectedIndex) {
                el.classList.add('nav-selected');
            } else {
                el.classList.remove('nav-selected');
            }
        });
    }
}
