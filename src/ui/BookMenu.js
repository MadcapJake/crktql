export class BookMenu {
    constructor() {
        this.isOpen = false;
        this.selectedIndex = 0;

        this.options = [
            { key: 'new', label: 'New Book', icon: '<i class="fa-solid fa-book-medical"></i>' },
            { key: 'open', label: 'Open Book', icon: '<i class="fa-solid fa-book-open"></i>' },
            { key: 'save', label: 'Save Book', icon: '<i class="fa-regular fa-floppy-disk"></i>' },
            { key: 'done', label: 'Done', className: 'done-btn', icon: '<i class="fa-solid fa-check"></i>' }
        ];

        this.onAction = null;
        this.lastDpad = { up: false, down: false, left: false, right: false };
        this.lastButtons = {};
        this.debounceCounter = 0;
    }

    toggle(initialInput) {
        this.isOpen = !this.isOpen;
        if (this.isOpen) {
            this.debounceCounter = 15; // Anti-flicker
            if (initialInput && initialInput.buttons) {
                this.lastButtons = { ...initialInput.buttons };
            }
        }
        this.render();
        return this.isOpen;
    }

    handleInput(input) {
        if (!this.isOpen || !input) return;

        if (this.debounceCounter > 0) {
            this.debounceCounter--;
            this.lastButtons = { ...input.buttons };
            this.lastDpad = { ...input.buttons.dpad };
            return;
        }

        const dpad = input.buttons.dpad;
        const pressed = (btn) => dpad[btn] && !this.lastDpad[btn];

        if (pressed('up')) {
            this.selectedIndex = (this.selectedIndex - 1 + this.options.length) % this.options.length;
            this.render();
        }
        if (pressed('down')) {
            this.selectedIndex = (this.selectedIndex + 1) % this.options.length;
            this.render();
        }

        const confirm = (input.buttons.south && !this.lastButtons?.south);
        const start = (input.buttons.start && !this.lastButtons?.start);

        if (confirm) {
            const option = this.options[this.selectedIndex];
            if (option.key === 'done') {
                this.toggle();
            } else {
                if (this.onAction) this.onAction(option.key);
                this.toggle();
            }
        } else if (start) {
            this.toggle(); // Close on Start
        }

        this.lastDpad = { ...dpad };
        this.lastButtons = { ...input.buttons };
    }

    render() {
        let modal = document.getElementById('book-menu-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'book-menu-modal';
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content">
                    <h2>Book Actions</h2>
                    <div class="settings-list" id="book-menu-list"></div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        modal.style.display = this.isOpen ? 'flex' : 'none';
        if (!this.isOpen) return;

        const list = document.getElementById('book-menu-list');
        list.innerHTML = '';

        this.options.forEach((opt, index) => {
            const row = document.createElement('div');
            row.className = `settings-item ${index === this.selectedIndex ? 'selected' : ''}`;
            if (opt.className) row.classList.add(opt.className);

            row.innerHTML = `
                <span style="flex:1;">${opt.icon} ${opt.label}</span>
            `;
            list.appendChild(row);
        });
    }
}
