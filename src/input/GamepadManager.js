export class GamepadManager {
    getActiveGamepad() {
        // Safety check: ensure the active index actually points to a valid controller
        if (this.activeGamepadIndex !== null && this.controllers[this.activeGamepadIndex]) {
            return this.controllers[this.activeGamepadIndex];
        }
        // Fallback: grab the first available one
        const indices = Object.keys(this.controllers);
        if (indices.length > 0) return this.controllers[indices[0]];
        return null;
    }

    constructor() {
        this.controllers = {};
        this.activeGamepadIndex = null;
        this.lastActiveGamepadIndex = null;
        this.lockedIndex = null;
        this.deadzone = 0.5;

        this.missingFrames = {};
        this.DISCONNECT_THRESHOLD = 5; // Number of frames to wait before declaring a controller disconnected

        this.animationFrameId = null;
        this.listeners = {
            'frame': [],
            'connect': [],
            'disconnect': [],
            'active-change': []
        };

        // Input History
        this.lastStart = false;
        this.lastSelect = false;
        this.lastButtons = {};

        // Standard events (still useful for plug-in/plug-out)
        window.addEventListener("gamepadconnected", this.onGamepadConnected.bind(this));
        window.addEventListener("gamepaddisconnected", this.onGamepadDisconnected.bind(this));

        // interaction listeners to "wake up" the API on first click/tap
        const wakeUp = () => { this.scanGamepads() };
        window.addEventListener('click', wakeUp);
        window.addEventListener('keydown', wakeUp);
        window.addEventListener('touchstart', wakeUp);

        // Start polling immediately to catch already-connected controllers (Steam Deck)
        this.startPolling();
    }

    /**
     * Force-check API (useful for wake-up events)
     */
    scanGamepads() {
        this.poll();
    }

    handleConnect(gamepad) {
        this.onGamepadConnected({ gamepad });
    }

    handleDisconnect(gamepad) {
        this.onGamepadDisconnected({ gamepad });
    }

    onGamepadConnected(e) {
        // Prevent duplicate registration
        if (this.controllers[e.gamepad.index]) return;

        console.log("Gamepad connected", e.gamepad);
        this.controllers[e.gamepad.index] = e.gamepad;
        this.missingFrames[e.gamepad.index] = 0; // Reset counter

        // Default to this one if none active
        if (this.activeGamepadIndex === null) {
            this.activeGamepadIndex = e.gamepad.index;
        }

        this.emit('connect', e.gamepad);
    }

    onGamepadDisconnected(e) {
        if (this.controllers[e.gamepad.index]) {
            console.log("Gamepad disconnected", e.gamepad);
            delete this.controllers[e.gamepad.index];
            delete this.missingFrames[e.gamepad.index]; // Cleanup counter
            this.emit('disconnect', e.gamepad);
        }

        if (this.activeGamepadIndex === e.gamepad.index) {
            this.activeGamepadIndex = null;
            this.lastActiveGamepadIndex = null;
        }
    }

    startPolling() {
        if (!this.animationFrameId) {
            const loop = () => {
                this.poll();
                this.animationFrameId = requestAnimationFrame(loop);
            };
            this.animationFrameId = requestAnimationFrame(loop);
        }
    }

    stopPolling() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    poll() {
        // Query the browser API every frame
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : (navigator.webkitGetGamepads ? navigator.webkitGetGamepads() : []);

        // 0. Poll-based Disconnect Detection
        // Check if any registered controller is no longer present in the gamepads array or is null
        Object.keys(this.controllers).forEach(key => {
            const index = parseInt(key);

            // Check if this controller is missing from the browser's list
            if (!gamepads[index]) {
                // Increment missing counter
                this.missingFrames[index] = (this.missingFrames[index] || 0) + 1;

                // If it's been missing for too long, declare it disconnected
                if (this.missingFrames[index] >= this.DISCONNECT_THRESHOLD) {
                    // It disappeared! Manually trigger disconnect.
                    // We use the stored object because 'gamepads[index]' is null.
                    this.handleDisconnect(this.controllers[index]);
                }
            } else {
                // It exists! Reset the counter immediately.
                // This heals any 1-frame "blips" from the browser API.
                this.missingFrames[index] = 0;
            }
        });

        // 1. Update Controllers & Auto-Detect New Ones
        for (let i = 0; i < gamepads.length; i++) {
            const gp = gamepads[i];
            if (gp) {
                // Check if we have a registered controller at this index
                const existing = this.controllers[gp.index];

                if (!existing) {
                    // New controller at empty slot
                    this.handleConnect(gp);
                } else if (existing.id !== gp.id) {
                    // Controller SWAPPED at same index (disconnect old, connect new)
                    console.log("Gamepad Swapped at index", gp.index, "Old:", existing.id, "New:", gp.id);
                    this.handleDisconnect(existing);
                    this.handleConnect(gp);
                } else {
                    // Existing controller at same index
                    this.controllers[gp.index] = gp;
                    // Ensure reset missing counter since we saw it again
                    this.missingFrames[gp.index] = 0;
                }

                // Check Activity to switch active controller
                // Ignore axes at -1 (often resting triggers) to prevent false switching
                const hasInput = gp.buttons.some(b => b.pressed) || gp.axes.some(a => (Math.abs(a) > this.deadzone && a > -0.9));

                // Switch if input detected AND it's different from current
                // Switch if input detected AND it's different from current AND not locked
                if (hasInput && this.activeGamepadIndex !== gp.index && this.lockedIndex === null) {
                    this.activeGamepadIndex = gp.index;
                }
            }
        }

        // 2. Fallback if active disconnected
        if (this.activeGamepadIndex === null || !this.controllers[this.activeGamepadIndex]) {
            const keys = Object.keys(this.controllers);
            if (keys.length > 0) this.activeGamepadIndex = parseInt(keys[0]);
        }

        // 3. Emit Activity Change Check
        if (this.activeGamepadIndex !== this.lastActiveGamepadIndex) {
            const newGp = this.controllers[this.activeGamepadIndex];
            if (newGp) {
                console.log("Active Gamepad Switched:", newGp.index);
                this.emit('active-change', newGp);
            }
            this.lastActiveGamepadIndex = this.activeGamepadIndex;
        }

        // 4. Emit FRAME for the Active Controller ONLY
        if (this.activeGamepadIndex !== null && this.controllers[this.activeGamepadIndex]) {
            this.emit('frame', this.controllers[this.activeGamepadIndex]);
        }
    }

    // Simple event emitter
    on(event, callback) {
        if (!this.listeners[event]) this.listeners[event] = [];
        if (this.listeners[event]) {
            this.listeners[event].push(callback);
        }
    }

    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
    }

    updateLastButtons(input) {
        if (!input || !input.buttons) return;
        this.lastStart = input.buttons.start;
        this.lastSelect = input.buttons.select;
        this.lastButtons = { ...input.buttons };
    }

    lock(index) {
        console.log(`GamepadManager: Locking focus to Controller ${index}`);
        this.lockedIndex = index;
        this.activeGamepadIndex = index; // Force switch immediately
    }

    unlock() {
        console.log("GamepadManager: Unlocking focus");
        this.lockedIndex = null;
    }

    setDeadzone(val) {
        this.deadzone = val;
    }
}
