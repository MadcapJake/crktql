export class GamepadMenu {
    constructor() {
        this.isOpen = false;
        this.onCalibrate = null; // Callback
        this.gamepadInfo = null; // { id, index }
        this.openTime = 0;

        // Menu State
        this.selectedIndex = 0;
        // Items: 'info', 'calibrate', 'done'
        // We generate them dynamically based on state
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
        return this.isOpen;
    }

    open() {
        this.isOpen = true;
        this.openTime = Date.now();
        this.selectedIndex = 0; // Default to top (Info)
        this.render();
    }

    close() {
        this.isOpen = false;
        this.render();
    }

    setGamepadInfo(info) {
        this.gamepadInfo = info;
        if (this.isOpen) this.render();
    }

    handleInput(input) {
        if (!this.isOpen || !input) return;

        // 1. Debounce (Ignore inputs for 250ms after opening)
        if (Date.now() - this.openTime < 250) return;

        const { buttons } = input;

        // Close on Start or B
        if ((buttons.start && !this.lastButtons?.start) ||
            (buttons.east && !this.lastButtons?.east)) {
            this.close();
            return;
        }

        const dpad = buttons.dpad;
        const lastDpad = this.lastDpad || { up: false, down: false };

        // Navigation
        if (dpad.down && !lastDpad.down) {
            this.moveSelection(1);
        } else if (dpad.up && !lastDpad.up) {
            this.moveSelection(-1);
        }

        // Action (A)
        if (buttons.south && !this.lastButtons?.south) {
            this.executeAction();
        }

        // Save State
        this.lastButtons = {
            start: buttons.start,
            east: buttons.east,
            south: buttons.south
        };
        this.lastDpad = { up: dpad.up, down: dpad.down }; // Assuming dpad is object
    }

    moveSelection(delta) {
        const items = this.getItems();
        this.selectedIndex = (this.selectedIndex + delta + items.length) % items.length;
        this.render();
    }

    executeAction() {
        const items = this.getItems();
        const item = items[this.selectedIndex];

        if (item.type === 'info') {
            // Copy to clipboard
            if (this.gamepadInfo) {
                const text = `${this.gamepadInfo.id} (Index: ${this.gamepadInfo.index})`;
                navigator.clipboard.writeText(text).then(() => {
                    // Show small visual feedback?
                    // Ideally we'd flash the item. For now let's just re-render or trigger global notification?
                    // Since specific DOM access is inside render, let's just trigger a notification if possible
                    // But we don't have access to showNotification here comfortably without passing it in.
                    // We'll rely on a temporary text change in render
                    this.copiedFeedback = true;
                    this.render();
                    setTimeout(() => {
                        this.copiedFeedback = false;
                        if (this.isOpen) this.render();
                    }, 1000);
                });
            }
        } else if (item.type === 'calibrate') {
            if (this.onCalibrate) {
                this.close();
                this.onCalibrate();
            }
        } else if (item.type === 'done') {
            this.close();
        }
    }

    getItems() {
        return [
            { type: 'info', label: 'Controller Info' },
            { type: 'calibrate', label: 'Calibrate Controller' },
            { type: 'done', label: 'Done' }
        ]; // Ordered list
    }

    render() {
        const modal = document.getElementById('gamepad-modal');
        if (!modal) return;

        if (!this.isOpen) {
            modal.style.display = 'none';
            return;
        }

        modal.style.display = 'flex';
        const content = modal.querySelector('.modal-content');
        if (content) {
            const name = this.gamepadInfo ? this.gamepadInfo.id : 'No Controller Connected';
            const index = this.gamepadInfo ? `Index: ${this.gamepadInfo.index}` : '';
            const copyText = this.copiedFeedback ? "Copied!" : "Press A to Copy";

            const items = this.getItems();

            let html = `<h2>Controller Status</h2>`;

            // Render Info Item
            // It's a special item that renders the text block
            const isInfoSelected = items[0].type === 'info' && this.selectedIndex === 0;
            const infoClass = isInfoSelected ? 'selected' : '';

            html += `
                <div class="settings-item ${infoClass}" 
                     style="display: block; text-align: center; margin-bottom: 1.5rem; padding: 1rem; border: 1px solid ${isInfoSelected ? 'var(--color-accent)' : 'transparent'}; border-radius: 8px;">
                    <div style="font-weight: bold; margin-bottom: 0.5rem; color: #fff;">${name}</div>
                    <div style="font-size: 0.8rem; color: #888;">${index}</div>
                    ${isInfoSelected ? `<div style="font-size: 0.7rem; color: var(--color-accent); margin-top: 5px;">${copyText}</div>` : ''}
                </div>
            `;

            // Render Calibrate Wrapper
            const isCalSelected = items[1].type === 'calibrate' && this.selectedIndex === 1;
            html += `
                <div class="settings-item ${isCalSelected ? 'selected' : ''}" style="justify-content: center;">
                   <span class="settings-label">Calibrate Controller</span>
                </div>
            `;

            // Render Done Wrapper
            const isDoneSelected = items[2].type === 'done' && this.selectedIndex === 2;
            html += `
                 <div class="settings-item ${isDoneSelected ? 'selected' : ''} done-btn" style="justify-content: center; margin-top: 1rem;">
                   <span style="width:100%; text-align:center;">Done</span>
                </div>
            `;



            content.innerHTML = html;

            // Add mouse handlers
            const infoDiv = content.querySelector('.settings-item:nth-child(2)'); // Title is h2 (1), then Info (2)
            if (infoDiv) infoDiv.onclick = () => { this.selectedIndex = 0; this.executeAction(); };

            const calDiv = content.querySelector('.settings-item:nth-child(3)');
            if (calDiv) calDiv.onclick = () => { this.selectedIndex = 1; this.executeAction(); };

            const doneDiv = content.querySelector('.settings-item:nth-child(4)');
            if (doneDiv) doneDiv.onclick = () => { this.selectedIndex = 2; this.executeAction(); };
        }
    }
}
