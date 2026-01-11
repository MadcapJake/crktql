
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
            'new-book-btn',
            'save-book-btn',
            'open-book-btn'
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
            this.triggerAction(this.items[this.selectedIndex]);
        }

        this.lastNav = { left: leftInput, right: rightInput };
        this.lastAction = actionPressed;
    }

    triggerAction(id) {
        document.getElementById(id)?.click();
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
