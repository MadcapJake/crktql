import { SubMenu } from './SubMenu.js';

export class GamepadMenu extends SubMenu {
    constructor() {
        super('gamepad-info-modal', 'Controller Info');
        this.gamepadInfo = null; // { id, index }
        this.onCalibrate = null; // Callback
        this.copiedFeedback = false;

        // Initial placeholder options
        this.options = [];
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
            { key: 'calibrate', label: 'Calibrate Sticks', icon: '<i class="fa-solid fa-crosshairs"></i>' },
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

    renderItemContent(opt) {
        if (opt.key === 'info') {
            const label = this.copiedFeedback ? "Copied to Clipboard!" : opt.label;
            const style = this.copiedFeedback ? "color: var(--color-accent);" : "";
            return `<span style="flex:1; ${style}">${opt.icon} ${label}</span>`;
        }
        return super.renderItemContent(opt);
    }
}
