export class Gutter {
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

        this.selectedIndex = this.items.length - 1;
        this.isActive = false;
    }

    activate() {
        this.isActive = true;
        this.render();
    }

    deactivate() {
        this.isActive = false;
        this.render();
    }

    getItemCount() {
        return this.items.length;
    }

    setSelectedIndex(index) {
        this.selectedIndex = index;
        this.render();
    }

    triggerAction(index, input) {
        if (index < 0 || index >= this.items.length) return;
        const id = this.items[index];
        const el = document.getElementById(id);

        if (el) {
            if (id === 'help-btn') {
                window.dispatchEvent(new CustomEvent('request-help-toggle', { detail: { input } }));
                el.click();
            } else if (id === 'export-logs-btn') {
                window.dispatchEvent(new CustomEvent('request-export-logs'));
                el.click(); // Optional visual feedback
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
