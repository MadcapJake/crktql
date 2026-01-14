export class GamepadManager {
    getActiveGamepad() {
        const indices = Object.keys(this.controllers);
        if (indices.length > 0) return this.controllers[indices[0]];
        return null;
    }

    constructor() {
        this.controllers = {};
        this.activeGamepadIndex = null;
        this.lastActiveGamepadIndex = null;
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

        // Start polling immediately to catch already-connected controllers (Steam Deck)
        this.startPolling();
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
        delete this.controllers[e.gamepad.index];

        if (this.activeGamepadIndex === e.gamepad.index) {
            this.activeGamepadIndex = null;
            this.lastActiveGamepadIndex = null;
        }

        this.emit('disconnect', e.gamepad);
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

        // 1. Update Controllers & Auto-Detect New Ones
        for (let i = 0; i < gamepads.length; i++) {
            const gp = gamepads[i];
            if (gp) {
                // If we found a gamepad that isn't registered yet, register it immediately
                if (!this.controllers[gp.index]) {
                    this.handleConnect(gp);
                }

                // Update the state
                this.controllers[gp.index] = gp;

                // Check Activity to switch active controller
                const hasInput = gp.buttons.some(b => b.pressed) || gp.axes.some(a => Math.abs(a) > 0.15);
                if (hasInput) {
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
}
