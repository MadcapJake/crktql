export class GamepadManager {
    getActiveGamepad() {
        const indices = Object.keys(this.controllers);
        if (indices.length > 0) return this.controllers[indices[0]];
        return null;
    }

    constructor() {
        this.controllers = {};
        this.activeGamepadIndex = null; // Track which controller is being used
        this.animationFrameId = null;
        this.listeners = {
            'frame': [],
            'connect': [],
            'disconnect': []
        };

        window.addEventListener("gamepadconnected", this.onGamepadConnected.bind(this));
        window.addEventListener("gamepaddisconnected", this.onGamepadDisconnected.bind(this));

        // Polling for initial connection (some browsers don't fire event if already connected)
        this.checkInterval = setInterval(this.scanGamepads.bind(this), 500);

        // Also check on user interaction
        window.addEventListener('click', () => this.scanGamepads());
        window.addEventListener('keydown', () => this.scanGamepads());
    }

    scanGamepads() {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : (navigator.webkitGetGamepads ? navigator.webkitGetGamepads() : []);
        for (let i = 0; i < gamepads.length; i++) {
            if (gamepads[i] && !this.controllers[gamepads[i].index]) {
                // Manually trigger connect
                this.onGamepadConnected({ gamepad: gamepads[i] });
            }
        }
    }

    handleConnect(gamepad) {
        this.onGamepadConnected({ gamepad });
    }

    handleDisconnect(gamepad) {
        this.onGamepadDisconnected({ gamepad });
    }

    onGamepadConnected(e) {
        console.log("Gamepad connected", e.gamepad);
        this.controllers[e.gamepad.index] = e.gamepad;

        // Default to this one if none active
        if (this.activeGamepadIndex === null) {
            this.activeGamepadIndex = e.gamepad.index;
        }

        this.emit('connect', e.gamepad);

        // Start polling if this is the first controller
        if (Object.keys(this.controllers).length === 1 && !this.animationFrameId) {
            this.startPolling();
            if (this.checkInterval) {
                clearInterval(this.checkInterval);
                this.checkInterval = null;
            }
        }
    }

    onGamepadDisconnected(e) {
        console.log("Gamepad disconnected", e.gamepad);
        delete this.controllers[e.gamepad.index];

        if (this.activeGamepadIndex === e.gamepad.index) {
            this.activeGamepadIndex = null; // Will pick new one next poll
        }

        this.emit('disconnect', e.gamepad);

        if (Object.keys(this.controllers).length === 0) {
            this.stopPolling();
        }
    }

    startPolling() {
        const loop = () => {
            this.poll();
            this.animationFrameId = requestAnimationFrame(loop);
        };
        this.animationFrameId = requestAnimationFrame(loop);
    }

    stopPolling() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    poll() {
        // Gamepad objects are snapshots, we need to query them again each frame
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : (navigator.webkitGetGamepads ? navigator.webkitGetGamepads() : []);

        // 1. Update Controllers & Check Activity (Last Input Wins)
        for (let i = 0; i < gamepads.length; i++) {
            const gp = gamepads[i];
            if (gp) {
                this.controllers[gp.index] = gp;

                // Check Activity
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

        // 3. Emit for the Active Controller ONLY
        if (this.activeGamepadIndex !== null && this.controllers[this.activeGamepadIndex]) {
            this.emit('frame', this.controllers[this.activeGamepadIndex]);
        }
    }

    // Simple event emitter
    on(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event].push(callback);
        }
    }

    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
    }
}
