import { SubMenu } from './SubMenu.js';

export class GamepadMenu extends SubMenu {
    constructor() {
        super('gamepad-info-modal', 'Controller Info');
        this.gamepadInfo = null; // { id, index }
        this.onCalibrate = null; // Callback
        this.copiedFeedback = false;

        // Initial placeholder options
        this.options = [];
        this.deadzone = 0.5; // Default, overriden by setDeadzone
        this.onDeadzoneChange = null;
    }

    setDeadzone(val) {
        this.deadzone = val;
        if (this.isOpen) this.render();
    }

    setGamepadInfo(info) {
        this.gamepadInfo = info;
        this.updateOptions();
        if (this.isOpen) this.render();
    }

    onOpen() {
        this.updateOptions();
        this.copiedFeedback = false;
    }

    updateOptions() {
        const infoText = this.gamepadInfo ? (this.gamepadInfo.id + ` [Index: ${this.gamepadInfo.index}]`) : 'No Controller Detected';

        this.options = [
            { key: 'info', label: infoText, type: 'info', icon: '<i class="fa-solid fa-gamepad"></i>' },
            { key: 'deadzone', label: 'Joystick Deadzone', type: 'range', min: 0.1, max: 0.9, step: 0.1 },
            { key: 'calibrate', label: 'Map Controller', icon: '<i class="fa-solid fa-screwdriver-wrench"></i>' },
            { key: 'done', label: 'Done', className: 'done-btn', icon: '<i class="fa-solid fa-check"></i>' }
        ];
    }

    onConfirm(item) {
        if (item.key === 'done') {
            this.close();
        } else if (item.key === 'calibrate') {
            this.close();
            if (this.onCalibrate) this.onCalibrate();
        } else if (item.type === 'info' || item.key === 'info') {
            // Copy to clipboard
            if (this.gamepadInfo) {
                const text = `${this.gamepadInfo.id} (Index: ${this.gamepadInfo.index})`;
                navigator.clipboard.writeText(text).then(() => {
                    this.copiedFeedback = true;
                    this.render();
                    setTimeout(() => {
                        this.copiedFeedback = false;
                        if (this.isOpen) this.render();
                    }, 1000);
                });
            }
        }
    }

    onLeft(option) {
        if (option.type === 'range') this.adjustRange(option, -1);
    }

    onRight(option) {
        if (option.type === 'range') this.adjustRange(option, 1);
    }

    adjustRange(option, dir) {
        let val = this.deadzone + (option.step * dir);
        if (val > option.max) val = option.max;
        if (val < option.min) val = option.min;
        this.deadzone = parseFloat(val.toFixed(1));
        this.render();
        if (this.onDeadzoneChange) this.onDeadzoneChange(this.deadzone);
    }

    renderItemContent(opt) {
        if (opt.key === 'info') {
            const label = this.copiedFeedback ? "Copied to Clipboard!" : opt.label;
            const style = this.copiedFeedback ? "color: var(--color-accent);" : "";
            return `<span style="flex:1; ${style}">${opt.icon} ${label}</span>`;
        }
        if (opt.type === 'range') {
            const val = this.deadzone;
            const pct = ((val - opt.min) / (opt.max - opt.min)) * 100;
            return `
                <span class="settings-label">${opt.label}</span>
                <span style="flex:1;"></span>
                <span class="settings-value">${val}</span>
                <div style="display:inline-block; width:50px; height:4px; background:#333; margin-left:10px; vertical-align:middle; position:relative;">
                    <div style="position:absolute; left:0; top:0; height:100%; background:var(--color-accent); width:${pct}%"></div>
                </div>
            `;
        }
        return super.renderItemContent(opt);
    }
}

