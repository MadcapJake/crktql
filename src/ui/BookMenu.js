import { SubMenu } from './SubMenu.js';

export class BookMenu extends SubMenu {
    constructor() {
        super('book-menu-modal', 'Book Actions');
        this.bookManager = null;
        this.typingEngine = null;
        this.onActionCallback = null;

        // Initial Options (Placeholder)
        this.options = [];
    }

    setDependencies(bookManager, typingEngine) {
        this.bookManager = bookManager;
        this.typingEngine = typingEngine;
        this.updateOptions();
    }

    updateOptions() {
        if (!this.bookManager) return;

        const metadata = this.bookManager.metadata;
        const availableSystems = this.typingEngine ? this.typingEngine.getAvailableMappings() : ['Latin'];

        // Fonts list - Hardcoded for now
        const availableFonts = [
            'Courier New', 'Arial', 'Charis SIL', 'Doulos SIL',
            'Gentium Plus', 'Gentium Book Plus', 'Hisyoto Sans', 'Hisyakui'
        ];

        this.options = [
            { key: 'new', label: 'New Book', icon: '<i class="fa-solid fa-book-medical"></i>' },
            { key: 'open', label: 'Open Book', icon: '<i class="fa-solid fa-book-open"></i>' },
            { key: 'save', label: 'Save Book', icon: '<i class="fa-regular fa-floppy-disk"></i>' },
            { key: 'rename_book', label: 'Rename Book', icon: '<i class="fa-solid fa-pen"></i>' },
            { key: 'writingSystem', label: 'Book Writing System', type: 'select', values: availableSystems, value: metadata.writingSystem },
            { key: 'font', label: 'Book Font', type: 'select', values: availableFonts, value: metadata.font },
            { key: 'done', label: 'Done', className: 'done-btn', icon: '<i class="fa-solid fa-check"></i>' }
        ];
    }

    onOpen() {
        this.updateOptions();
    }

    set onAction(cb) {
        this.onActionCallback = cb;
    }

    get onAction() {
        return this.onActionCallback;
    }

    onConfirm(item) {
        if (item.key === 'done') {
            this.close();
        } else if (item.type === 'select') {
            this.adjustSelect(item, 1);
        } else {
            if (this.onActionCallback) this.onActionCallback(item.key);

            // Close logic
            if (['new', 'open', 'save', 'rename_book'].includes(item.key)) {
                this.close();
            }
        }
    }

    onLeft(item) {
        if (item.type === 'select') this.adjustSelect(item, -1);
    }

    onRight(item) {
        if (item.type === 'select') this.adjustSelect(item, 1);
    }

    adjustSelect(item, dir) {
        if (!this.bookManager) return;

        const currIdx = item.values.indexOf(item.value);
        const nextIdx = (currIdx + dir + item.values.length) % item.values.length;
        const newValue = item.values[nextIdx];

        item.value = newValue;

        if (item.key === 'writingSystem') {
            this.bookManager.metadata.writingSystem = newValue;
        } else if (item.key === 'font') {
            this.bookManager.metadata.font = newValue;
        }

        this.bookManager.saveToStorage();

        if (this.onActionCallback) {
            this.onActionCallback('update_metadata');
        }

        this.render();
    }

    renderItemContent(opt) {
        if (opt.type === 'select') {
            return `
                <span class="settings-label">${opt.label}</span>
                <span style="flex:1;"></span>
                <span class="settings-value">${opt.value}</span>
            `;
        }
        return super.renderItemContent(opt);
    }
}
