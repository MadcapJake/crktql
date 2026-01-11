import { SubMenu } from './SubMenu.js';

export class BookMenu extends SubMenu {
    constructor() {
        super('book-menu-modal', 'Book Actions');

        this.options = [
            { key: 'new', label: 'New Book', icon: '<i class="fa-solid fa-book-medical"></i>' },
            { key: 'open', label: 'Open Book', icon: '<i class="fa-solid fa-book-open"></i>' },
            { key: 'save', label: 'Save Book', icon: '<i class="fa-regular fa-floppy-disk"></i>' },
            { key: 'done', label: 'Done', className: 'done-btn', icon: '<i class="fa-solid fa-check"></i>' }
        ];

        this.onActionCallback = null; // Renamed to avoid conflict with method
    }

    // Wiring up the external onAction setter to our internal callback
    set onAction(cb) {
        this.onActionCallback = cb;
    }

    get onAction() {
        return this.onActionCallback;
    }

    onConfirm(item) {
        if (item.key === 'done') {
            this.close();
        } else {
            if (this.onActionCallback) this.onActionCallback(item.key);
            this.close(); // Always close on book actions
        }
    }
}
