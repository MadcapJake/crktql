/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GamepadManager } from '../src/input/GamepadManager';

describe('GamepadManager', () => {
    let manager;

    beforeEach(() => {
        vi.useFakeTimers();
        // Mock requestAnimationFrame to run immediately
        vi.stubGlobal('requestAnimationFrame', (fn) => setTimeout(fn, 16));
        vi.stubGlobal('cancelAnimationFrame', (id) => clearTimeout(id));
    });

    afterEach(() => {
        if (manager) manager.stopPolling();
        vi.restoreAllMocks();
    });

    it('detects pre-connected controllers on initialization', () => {
        // Mock Browser API with one controller already connected
        const mockGamepad = { index: 0, id: 'Steam Deck', buttons: [], axes: [] };
        navigator.getGamepads = vi.fn().mockReturnValue([mockGamepad]);

        manager = new GamepadManager();

        // Fast forward polling loop
        vi.advanceTimersByTime(50);

        expect(manager.controllers[0]).toBeDefined();
        expect(manager.controllers[0].id).toBe('Steam Deck');
    });

    it('stays connected if only disconnected for a frame', () => {
        const mockGamepad = { index: 0, id: 'Xbox', buttons: [], axes: [] };
        navigator.getGamepads = vi.fn().mockReturnValue([mockGamepad]);

        manager = new GamepadManager();
        vi.advanceTimersByTime(50);
        expect(manager.controllers[0]).toBeDefined();

        // Simulate disconnect (API returns null at index 0)
        navigator.getGamepads = vi.fn().mockReturnValue([null]);

        // Spy on disconnect event
        const onDisconnect = vi.fn();
        manager.on('disconnect', onDisconnect);

        // Must wait longer than DISCONNECT_THRESHOLD
        vi.advanceTimersByTime(16);

        expect(manager.controllers[0]).toBeDefined();
        expect(onDisconnect).not.toHaveBeenCalled();
    });

    it('handles "Ghost" disconnects when API returns null', () => {
        const mockGamepad = { index: 0, id: 'Xbox', buttons: [], axes: [] };
        navigator.getGamepads = vi.fn().mockReturnValue([mockGamepad]);

        manager = new GamepadManager();
        vi.advanceTimersByTime(50);
        expect(manager.controllers[0]).toBeDefined();

        // Simulate disconnect (API returns null at index 0)
        navigator.getGamepads = vi.fn().mockReturnValue([null]);

        // Spy on disconnect event
        const onDisconnect = vi.fn();
        manager.on('disconnect', onDisconnect);

        // Must wait longer than DISCONNECT_THRESHOLD
        vi.advanceTimersByTime(80);

        expect(manager.controllers[0]).toBeUndefined();
        expect(onDisconnect).toHaveBeenCalled();
    });
});
