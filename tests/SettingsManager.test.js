
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SettingsManager } from '../src/ui/SettingsManager';

describe('SettingsManager', () => {
    let settingsManager;

    beforeEach(() => {
        // Mock LocalStorage
        const storage = {};
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => storage[key] || null);
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, v) => { storage[key] = v; });
        vi.spyOn(Storage.prototype, 'clear').mockImplementation(() => { for (const k in storage) delete storage[k]; });


        // Mock UI methods to avoid DOM errors in SubMenu
        settingsManager = new SettingsManager();
        settingsManager.render = vi.fn();
        settingsManager.show = vi.fn();
        settingsManager.close = vi.fn();
        settingsManager.onUpdate = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('initializes with default config', () => {
        expect(settingsManager.config).toEqual(expect.objectContaining({
            visualizer: true,
            debug: true,
            deadzone: 0.5,
            onsetConflict: 'COMMIT',
            visualizerPlacement: 'BOTTOM_CENTER',
            cursorType: 'BAR'
        }));
    });

    it('loads settings from storage on init', () => {
        const saved = JSON.stringify({ visualizer: false, deadzone: 0.2 });
        localStorage.setItem('crktqla_settings', saved);

        // Create new instance to trigger load (or call load manually)
        // Constructor doesn't call loadSettings?
        // Let's check implementation. Lines 3-25 constructor does NOT call loadSettings.
        // It must be called externally usually.
        settingsManager.loadSettings();

        expect(settingsManager.config.visualizer).toBe(false);
        expect(settingsManager.config.deadzone).toBe(0.2);
        // Defaults preserved
        expect(settingsManager.config.debug).toBe(true);
    });

    it('saves settings to storage', () => {
        settingsManager.config.visualizer = false;
        settingsManager.saveSettings();

        expect(localStorage.setItem).toHaveBeenCalledWith('crktqla_settings', expect.any(String));
        const stored = JSON.parse(localStorage.setItem.mock.calls[0][1]);
        expect(stored.visualizer).toBe(false);
    });

    it('toggles boolean option', () => {
        const option = { key: 'visualizer', type: 'toggle' };
        settingsManager.config.visualizer = true;

        settingsManager.toggleOption(option);

        expect(settingsManager.config.visualizer).toBe(false);
        expect(settingsManager.onUpdate).toHaveBeenCalled();
        expect(localStorage.setItem).toHaveBeenCalled();
    });

    it('cycles select option forward', () => {
        const option = { key: 'cursorType', type: 'select', values: ['BAR', 'BLOCK', 'UNDERLINE'] };
        settingsManager.config.cursorType = 'BAR';

        settingsManager.adjustSelect(option, 1);
        expect(settingsManager.config.cursorType).toBe('BLOCK');

        settingsManager.adjustSelect(option, 1);
        expect(settingsManager.config.cursorType).toBe('UNDERLINE');

        settingsManager.adjustSelect(option, 1);
        expect(settingsManager.config.cursorType).toBe('BAR'); // Loop
    });

    it('claps range option', () => {
        const option = { key: 'deadzone', type: 'range', min: 0.0, max: 1.0, step: 0.1 };
        settingsManager.config.deadzone = 0.9;

        settingsManager.adjustRange(option, 1); // 1.0
        expect(settingsManager.config.deadzone).toBe(1.0);

        settingsManager.adjustRange(option, 1); // 1.1 (should clamp)
        expect(settingsManager.config.deadzone).toBe(1.0);
    });
});
