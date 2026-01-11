import { SubMenu } from './SubMenu.js';

export class SettingsManager extends SubMenu {
    constructor() {
        super('settings-modal', 'Settings');

        this.config = {
            visualizer: true,
            debug: true,
            deadzone: 0.5,
            onsetConflict: 'COMMIT',
            visualizerPlacement: 'BOTTOM_CENTER',
            cursorType: 'BAR'
        };

        this.options = [
            { key: 'visualizer', label: 'Visualizer', type: 'toggle' },
            { key: 'visualizerPlacement', label: 'Vis. Placement', type: 'select', values: ['BOTTOM_CENTER', 'BOTTOM_OUTER', 'TOP_CENTER', 'TOP_OUTER'] },
            { key: 'debug', label: 'Developer Mode', type: 'toggle' },
            { key: 'cursorType', label: 'Cursor Type', type: 'select', values: ['BAR', 'BLOCK', 'UNDERLINE'] },
            { key: 'deadzone', label: 'Deadzone', type: 'range', min: 0.1, max: 0.9, step: 0.1 },
            { key: 'onsetConflict', label: 'Onset Conflict', type: 'select', values: ['COMMIT', 'IGNORE', 'SWITCH'] },
            { key: 'done', label: 'Done', type: 'action', className: 'done-btn' }
        ];
    }

    onConfirm(option) {
        if (option.key === 'done') {
            this.close();
            return;
        }
        if (option.type === 'action') return; // Generic action?

        this.toggleOption(option);
    }

    onLeft(option) {
        if (option.type === 'range') this.adjustRange(option, -1);
        if (option.type === 'select') this.adjustSelect(option, -1);
    }

    onRight(option) {
        if (option.type === 'range') this.adjustRange(option, 1);
        if (option.type === 'select') this.adjustSelect(option, 1);
    }

    toggleOption(option) {
        if (option.type === 'toggle') {
            console.log(`[SettingsManager] Toggling ${option.key}. onUpdate is:`, this.onUpdate);
            this.config[option.key] = !this.config[option.key];
            this.render();
            if (this.onUpdate) {
                console.log('[SettingsManager] Calling onUpdate...');
                this.onUpdate(this.config);
            } else {
                console.warn('[SettingsManager] onUpdate is missing!');
            }
        } else if (option.type === 'select' || option.type === 'range') {
            // Tapping A on select/range circles forward
            this.onRight(option);
        }
    }

    adjustRange(option, dir) {
        let val = this.config[option.key] + (option.step * dir);
        if (val > option.max) val = option.max;
        if (val < option.min) val = option.min;
        this.config[option.key] = parseFloat(val.toFixed(1));
        this.render();
        if (this.onUpdate) this.onUpdate(this.config);
    }

    adjustSelect(option, dir) {
        const currIdx = option.values.indexOf(this.config[option.key]);
        const nextIdx = (currIdx + dir + option.values.length) % option.values.length;
        this.config[option.key] = option.values[nextIdx];
        this.render();
        if (this.onUpdate) this.onUpdate(this.config);
    }

    renderItemContent(opt) {
        if (opt.key === 'done') {
            return `<span style="width:100%; text-align:center;">Done</span>`;
        }

        let valueDisplay = '';
        const val = this.config[opt.key];

        if (opt.type === 'toggle') {
            valueDisplay = val ? '<i class="fa-solid fa-toggle-on" style="color:var(--color-accent)"></i>' : '<i class="fa-solid fa-toggle-off" style="color:#666"></i>';
        } else if (opt.type === 'select') {
            valueDisplay = `<span class="settings-value">${val}</span>`;
        } else if (opt.type === 'range') {
            // Visualize range?
            const pct = ((val - opt.min) / (opt.max - opt.min)) * 100;
            valueDisplay = `<span class="settings-value">${val}</span> <div style="display:inline-block; width:50px; height:4px; background:#333; margin-left:10px; vertical-align:middle; position:relative;"><div style="position:absolute; left:0; top:0; height:100%; background:var(--color-accent); width:${pct}%"></div></div>`;
        }

        return `
            <span class="settings-label">${opt.label}</span>
            <span style="flex:1;"></span>
            ${valueDisplay}
        `;
    }
}
