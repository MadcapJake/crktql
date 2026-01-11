export class SubMenu {
    constructor(elementId, title) {
        this.elementId = elementId;
        this.title = title;
        this.isOpen = false;
        this.selectedIndex = 0;
        this.options = []; // Class subclasses should populate this or override getOptions()

        this.lastDpad = { up: false, down: false, left: false, right: false };
        this.lastButtons = {};
        this.debounceCounter = 0;
    }

    toggle(initialInput) {
        this.isOpen = !this.isOpen;
        if (this.isOpen) {
            this.debounceCounter = 15; // Anti-flicker delay
            if (initialInput && initialInput.buttons) {
                this.lastButtons = { ...initialInput.buttons };
            }
            this.onOpen();
        } else {
            this.onClose();
        }
        this.render();
        return this.isOpen;
    }

    open() {
        if (!this.isOpen) this.toggle();
    }

    close() {
        if (this.isOpen) this.toggle();
    }

    onOpen() {
        // Override
    }

    onClose() {
        // Override
    }

    handleInput(input) {
        if (!this.isOpen || !input) return;

        // Debounce
        if (this.debounceCounter > 0) {
            this.debounceCounter--;
            this.lastButtons = { ...input.buttons };
            this.lastDpad = { ...input.buttons.dpad };
            return;
        }

        const dpad = input.buttons.dpad;
        const pressed = (btn) => dpad[btn] && !this.lastDpad[btn];

        // Navigation
        if (pressed('up')) {
            this.selectedIndex = (this.selectedIndex - 1 + this.options.length) % this.options.length;
            this.render();
        }
        if (pressed('down')) {
            this.selectedIndex = (this.selectedIndex + 1) % this.options.length;
            this.render();
        }

        // Feature Specific Input (Left/Right for sliders etc)
        if (pressed('left')) this.onLeft(this.options[this.selectedIndex]);
        if (pressed('right')) this.onRight(this.options[this.selectedIndex]);

        // Actions
        // Cancel: Start (or B if we wanted, but User explicitly removed B)
        if ((input.buttons.start && !this.lastButtons?.start)) {
            this.close();
        }

        // Confirm: A (South) OR sometimes Right/Left depending on interaction, but usually A.
        if (input.buttons.south && !this.lastButtons?.south) {
            this.onConfirm(this.options[this.selectedIndex]);
        }

        this.lastDpad = { ...dpad };
        this.lastButtons = { ...input.buttons };
    }

    onConfirm(item) {
        // Default behavior: Check for 'done' key or call onAction
        if (item.key === 'done') {
            this.close();
        } else if (this.onAction) {
            this.onAction(item.key);
            // Default close on action? Subclasses can override if they want to stay open (like Settings)
            // For generic menu, we usually close.
            // But let's leave openness decision to the subclass logic.
            // Actually BookMenu closes, Settings stays open.
            // We'll let subclass override onConfirm if needed, or implement onAction to return 'close' or 'keep'.
        }
    }

    onLeft(item) {
        // Override for sliders/toggles
    }

    onRight(item) {
        // Override for sliders/toggles
    }

    render() {
        let modal = document.getElementById(this.elementId);

        if (!modal) {
            modal = document.createElement('div');
            modal.id = this.elementId;
            // Class-based styling (External CSS handles positioning)
            modal.className = 'modal-overlay';

            document.body.appendChild(modal);
        }

        modal.style.display = this.isOpen ? 'flex' : 'none';
        if (!this.isOpen) return;

        // Render Content
        modal.innerHTML = `
            <div class="modal-content">
                <h2>${this.title}</h2>
                <div class="settings-list" id="${this.elementId}-list"></div>
                ${this.getFooter()}
            </div>
        `;

        const list = document.getElementById(`${this.elementId}-list`);
        if (list) {
            this.options.forEach((opt, index) => {
                const row = document.createElement('div');
                row.className = `settings-item ${index === this.selectedIndex ? 'selected' : ''}`;
                if (opt.className) row.classList.add(opt.className);

                row.innerHTML = this.renderItemContent(opt);

                // Add click handler for mouse support (optional but good)
                row.onclick = () => {
                    this.selectedIndex = index;
                    this.onConfirm(opt);
                    this.render();
                };

                list.appendChild(row);
            });
        }
    }

    renderItemContent(opt) {
        // Default simple label
        return `<span style="flex:1;">${opt.icon || ''} ${opt.label}</span>`;
    }

    getFooter() {
        return ''; // Subclasses can return footer HTML
    }
}
