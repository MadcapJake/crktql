export class GamepadManager {
    getActiveGamepad() {
        if (this.activeGamepadIndex !== null && this.controllers[this.activeGamepadIndex]) {
            return this.controllers[this.activeGamepadIndex];
        }
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
        const wakeUp = () => {
            this.scanGamepads();
            // Optional: remove listeners after first successful detection if desired, 
            // but keeping them is safer for re-connections.
        };
        window.addEventListener('click', wakeUp);
        window.addEventListener('keydown', wakeUp);
        window.addEventListener('touchstart', wakeUp);

        // Start polling immediately to catch already-connected controllers (Steam Deck)
        this.startPolling();
    }

    // New helper to force-check API (useful for wake-up events)
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

        // Default to this one if none active
        if (this.activeGamepadIndex === null) {
            this.activeGamepadIndex = e.gamepad.index;
        }

        this.emit('connect', e.gamepad);
    }

    onGamepadDisconnected(e) {
        console.log("Gamepad disconnected", e.gamepad);
        if (this.controllers[e.gamepad.index]) {
            delete this.controllers[e.gamepad.index];
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
        Object.keys(this.controllers).forEach(index => {
            if (!gamepads[index]) {
                // It disappeared! Manually trigger disconnect.
                // We use the stored object because 'gamepads[index]' is null.
                this.handleDisconnect(this.controllers[index]);
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
                }

                // Update the state
                this.controllers[gp.index] = gp;

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
