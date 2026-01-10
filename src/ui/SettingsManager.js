export class SettingsManager {
    constructor() {
        this.isOpen = false;
        this.selectedIndex = 0;
        this.config = {
            visualizer: true,
            debug: false,
            deadzone: 0.5,
            onsetConflict: 'COMMIT',
            visualizerPlacement: 'BOTTOM_CENTER'
        };

        this.options = [
            { key: 'visualizer', label: 'Visualizer', type: 'toggle' },
            { key: 'visualizerPlacement', label: 'Vis. Placement', type: 'select', values: ['BOTTOM_CENTER', 'BOTTOM_OUTER', 'TOP_CENTER', 'TOP_OUTER'] },
            { key: 'debug', label: 'Diagnostics', type: 'toggle' },
            { key: 'deadzone', label: 'Deadzone', type: 'range', min: 0.1, max: 0.9, step: 0.1 },
            { key: 'onsetConflict', label: 'Onset Conflict', type: 'select', values: ['COMMIT', 'IGNORE', 'SWITCH'] },
            { key: 'calibrate', label: 'Recalibrate Controller', type: 'action' },
            { key: 'done', label: 'Done', type: 'action', className: 'done-btn' }
        ];

        this.onUpdate = null;
        this.onAction = null;
        this.lastDpad = { up: false, down: false, left: false, right: false };
        this.openTime = 0;
    }

    toggle() {
        this.isOpen = !this.isOpen;
        if (this.isOpen) {
            this.openTime = Date.now();
        }
        this.render();
        return this.isOpen;
    }

    handleInput(input) {
        if (!this.isOpen || !input) return;

        // Input Cooldown to prevent accidental triggering on open
        if (Date.now() - this.openTime < 500) {
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

        const confirm = (input.buttons.south && !this.lastButtons?.south) || (input.buttons.east && !this.lastButtons?.east);

        if (confirm) {
            this.toggleOption(this.options[this.selectedIndex]);
        }

        this.lastDpad = { ...dpad };
        this.lastButtons = { south: input.buttons.south, east: input.buttons.east };
    }

    toggleOption(option) {
        if (option.key === 'done') {
            this.toggle();
            return;
        }

        if (option.type === 'action') {
            if (this.onAction) this.onAction(option.key);
            return;
        }

        if (option.type === 'toggle') {
            this.config[option.key] = !this.config[option.key];
        } else if (option.type === 'range') {
            let val = this.config[option.key] + option.step;
            if (val > option.max) val = option.min;
            this.config[option.key] = parseFloat(val.toFixed(1));
        } else if (option.type === 'select') {
            const currIdx = option.values.indexOf(this.config[option.key]);
            const nextIdx = (currIdx + 1) % option.values.length;
            this.config[option.key] = option.values[nextIdx];
        }

        this.render();
        if (this.onUpdate) this.onUpdate(this.config);
    }

    render() {
        const modal = document.getElementById('settings-modal');
        const list = document.getElementById('settings-list');

        if (!this.isOpen) {
            modal.style.display = 'none';
            return;
        }

        modal.style.display = 'flex';
        list.innerHTML = '';

        this.options.forEach((opt, index) => {
            const item = document.createElement('div');
            item.className = `settings-item ${index === this.selectedIndex ? 'selected' : ''} ${opt.className || ''}`;

            let valueDisplay = '';
            if (opt.key === 'done') {
                item.innerHTML = `<span style="width:100%; text-align:center;">Done</span>`;
            } else {
                if (opt.type === 'action') {
                    valueDisplay = '➜';
                } else {
                    valueDisplay = this.config[opt.key];
                    if (typeof valueDisplay === 'boolean') valueDisplay = valueDisplay ? 'ON' : 'OFF';
                }

                item.innerHTML = `
                    <span class="settings-label">${opt.label}</span>
                    <span class="settings-value">${valueDisplay}</span>
                `;
            }

            // Mouse Interaction
            item.addEventListener('click', () => {
                this.selectedIndex = index;
                this.toggleOption(opt);
            });

            list.appendChild(item);
        });
    }
}
